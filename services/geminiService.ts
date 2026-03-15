
import { GoogleGenAI, Type } from "@google/genai";
import { LoadDataPoint, GeneratorUnit, ForecastResult, HorizonUnit } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const performAIForecast = async (
  historicalData: LoadDataPoint[],
  horizonValue: number,
  horizonUnit: HorizonUnit,
  lookBack: number,
  units: GeneratorUnit[]
): Promise<ForecastResult> => {
  const recentData = historicalData.slice(-lookBack);
  // Summarize data for the AI context
  const dataSummary = recentData.map(d => `[${d.timestamp},${d.load}${d.isAnomaly ? ',A' : ''}]`).join(";");
  const unitsSummary = units.map(u => `${u.name}(${u.capacity}MW)`).join(",");

  const response = await ai.models.generateContent({
    model: "gemini-flash-latest",
    contents: `
      Context: Load points (Time,MW,A=Anomaly): ${dataSummary}
      Fleet: ${unitsSummary}
      Goal: High-precision Probabilistic Forecast for the next ${horizonValue} ${horizonUnit}.
      
      Calculation Requirements:
      1. Predict load + 95% Confidence Interval (lowerBound/upperBound).
      2. Unit Commitment: Select units to meet peak load + 15% reserve.
      3. Economics: Estimate projectedCostPerHour in Indian Rupees (₹). Use an average cost of ₹6,250 per MWh as a baseline for the region.
      4. Efficiency: Calculate systemEfficiency (Load/Active Capacity %).
      5. Timestamps: Ensure prediction timestamps continue sequentially from the last provided point (${historicalData[historicalData.length - 1]?.timestamp}).
      
      Output JSON:
      {
        "predictions": [{"timestamp": "YYYY-MM-DD HH:mm", "predicted": number, "lowerBound": number, "upperBound": number}],
        "generationRequirement": number,
        "recommendedUnits": ["string"],
        "maintenanceWindows": [{"start": "string", "end": "string", "suggestedUnit": "string", "avgLoadDuringWindow": number, "safetyMargin": number, "priority": "Routine|Urgent"}],
        "explanation": "string",
        "projectedCostPerHour": number,
        "systemEfficiency": number,
        "upgradeAdvisory": {"additionalUnitsNeeded": number, "targetTotalCapacity": number, "reasoning": "string", "priority": "Low|Critical"}
      }
    `,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          predictions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                timestamp: { type: Type.STRING },
                predicted: { type: Type.NUMBER },
                lowerBound: { type: Type.NUMBER },
                upperBound: { type: Type.NUMBER }
              },
              required: ["timestamp", "predicted", "lowerBound", "upperBound"]
            }
          },
          generationRequirement: { type: Type.NUMBER },
          recommendedUnits: { type: Type.ARRAY, items: { type: Type.STRING } },
          maintenanceWindows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                start: { type: Type.STRING },
                end: { type: Type.STRING },
                suggestedUnit: { type: Type.STRING },
                avgLoadDuringWindow: { type: Type.NUMBER },
                safetyMargin: { type: Type.NUMBER },
                priority: { type: Type.STRING }
              }
            }
          },
          explanation: { type: Type.STRING },
          projectedCostPerHour: { type: Type.NUMBER },
          systemEfficiency: { type: Type.NUMBER },
          upgradeAdvisory: {
            type: Type.OBJECT,
            properties: {
              additionalUnitsNeeded: { type: Type.NUMBER },
              targetTotalCapacity: { type: Type.NUMBER },
              reasoning: { type: Type.STRING },
              priority: { type: Type.STRING }
            }
          }
        },
        required: ["predictions", "generationRequirement", "recommendedUnits", "explanation", "maintenanceWindows", "projectedCostPerHour", "systemEfficiency"]
      }
    }
  });

  try {
    const text = response.text;
    return JSON.parse(text) as ForecastResult;
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error("Complex analysis failed. Check data granularity.");
  }
};
