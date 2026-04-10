from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import httpx
import math
import tempfile
import os
from datetime import datetime, timedelta

# Create FastAPI app
app = FastAPI(title="Powercast AI Backend")

# Enable CORS for the frontend Vite server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Models ===
class GeneratorUnit(BaseModel):
    id: str
    name: str
    capacity: float
    status: str

class ForecastRequest(BaseModel):
    horizon: int
    last_historical_load: float = 200.0
    units: List[GeneratorUnit]

class WeatherResponse(BaseModel):
    temperature: float
    humidity: float
    wind_speed: float
    cloud_cover: float
    feels_like: float
    pressure: float
    description: str

# Mock AI Prediction Logic (since we are replacing Gemini)
def generate_mock_forecast(horizon: int, last_load: float):
    predictions = []
    now = datetime.now().replace(minute=0, second=0, microsecond=0)
    for i in range(horizon):
        time = now + timedelta(hours=i+1) # start from next hour
        
        # Continuous simulated variation
        # Blend last_load seamlessly into a sine wave
        base_load = last_load + 50 * math.sin((i+1) * math.pi / 12) + (i * 2) 
        
        # Conformal Prediction logic (simple standard deviation bounds)
        confidence_delta = base_load * 0.15 # 15% interval
        
        predictions.append({
            "timestamp": time.strftime("%Y-%m-%d %H:%M"),
            "predicted_load_mw": round(base_load, 2),
            "lower_bound_mw": round(base_load - confidence_delta, 2),
            "upper_bound_mw": round(base_load + confidence_delta, 2)
        })
    return predictions

def run_decision_engine(predictions, units: List[GeneratorUnit]):
    # Find peak demand
    peak_demand = max([p["upper_bound_mw"] for p in predictions]) if predictions else 0
    total_capacity = sum([u.capacity for u in units])
    
    # Simple Decision Logic
    decisions = []
    current_capacity = 0
    
    # Sort units by capacity (largest first for base load)
    sorted_units = sorted(units, key=lambda x: x.capacity, reverse=True)
    
    for u in sorted_units:
        if current_capacity < peak_demand * 1.1: # 10% safety margin
            decisions.append({
                "unit_id": u.id,
                "unit_name": u.name,
                "recommendation": "ON",
                "reasoning": "Required to meet projected peak demand with safety margin."
            })
            current_capacity += u.capacity
        else:
            decisions.append({
                "unit_id": u.id,
                "unit_name": u.name,
                "recommendation": "STANDBY",
                "reasoning": "Keep in standby mode; not required for current baseline but useful for volatility."
            })
            
    # Find maintenance windows (periods where load is consistently < 40% of capacity)
    maintenance_windows = []
    if total_capacity > 0:
        low_load_count = 0
        window_start = None
        for p in predictions:
            if p["predicted_load_mw"] < total_capacity * 0.4:
                if low_load_count == 0:
                    window_start = p["timestamp"]
                low_load_count += 1
            else:
                if low_load_count >= 3: # at least 3 hours
                    maintenance_windows.append({
                        "start": window_start,
                        "end": p["timestamp"],
                        "reasoning": "Extended period of very low grid demand."
                    })
                low_load_count = 0
                window_start = None
                
    return {
        "unit_actions": decisions,
        "maintenance_windows": maintenance_windows,
        "utilization_percentage": round((peak_demand / total_capacity * 100), 2) if total_capacity > 0 else 0
    }

# === API Endpoints ===

@app.post("/api/forecast")
async def execute_forecast(req: ForecastRequest):
    predictions = generate_mock_forecast(req.horizon, req.last_historical_load)
    decisions = run_decision_engine(predictions, req.units)
    
    return {
        "predictions": predictions,
        "decisions": decisions
    }

@app.get("/api/weather", response_model=WeatherResponse)
async def get_weather():
    # Attempt to fetch real weather, fallback to defaults if needed
    API_KEY = os.getenv("OPENWEATHER_API_KEY")
    default_weather = {
        "temperature": 28.0,
        "humidity": 55.0,
        "wind_speed": 3.5,
        "cloud_cover": 40.0,
        "feels_like": 30.0,
        "pressure": 1013.0,
        "description": "Default (API unavailable)"
    }
    
    if not API_KEY:
        return default_weather
        
    try:
        # Example using Mumbai logic as per previous frontend implementation
        url = f"https://api.openweathermap.org/data/2.5/weather?lat=19.076&lon=72.877&appid={API_KEY}&units=metric"
        async with httpx.AsyncClient() as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            return {
                "temperature": data["main"]["temp"],
                "humidity": data["main"]["humidity"],
                "wind_speed": data["wind"]["speed"],
                "cloud_cover": data["clouds"]["all"],
                "feels_like": data["main"]["feels_like"],
                "pressure": data["main"]["pressure"],
                "description": data["weather"][0]["description"].title()
            }
    except Exception:
        return default_weather

from fastapi.responses import FileResponse
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet
import tempfile
import os

@app.post("/api/export/csv")
async def export_csv(req: ForecastRequest):
    predictions = generate_mock_forecast(req.horizon, req.last_historical_load)
    decisions = run_decision_engine(predictions, req.units)
    
    wb = Workbook()
    ws = wb.active
    ws.title = "Forecast Report"
    
    # Headers
    ws.append(["Timestamp", "Predicted Load (MW)", "Lower Bound (MW)", "Upper Bound (MW)"])
    for p in predictions:
        ws.append([p["timestamp"], p["predicted_load_mw"], p["lower_bound_mw"], p["upper_bound_mw"]])
        
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
    wb.save(temp_file.name)
    temp_file.close()
    return FileResponse(temp_file.name, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", filename="powercast_forecast.xlsx")

@app.post("/api/export/pdf")
async def export_pdf(req: ForecastRequest):
    predictions = generate_mock_forecast(req.horizon, req.last_historical_load)
    decisions = run_decision_engine(predictions, req.units)
    
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    doc = SimpleDocTemplate(temp_file.name, pagesize=letter)
    styles = getSampleStyleSheet()
    elements = []
    
    # Title
    elements.append(Paragraph("Powercast AI - Load Forecasting Report", styles['Title']))
    elements.append(Spacer(1, 12))
    
    # Decision Summary
    elements.append(Paragraph("Decision Support Summary", styles['Heading2']))
    decision_data = [["Unit Name", "Recommendation", "Reasoning"]]
    for d in decisions["unit_actions"]:
        decision_data.append([d["unit_name"], d["recommendation"], d["reasoning"]])
        
    t = Table(decision_data, colWidths=[100, 80, 250])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(t)
    elements.append(Spacer(1, 24))
    
    # Forecast Data
    elements.append(Paragraph("Forecast Projections", styles['Heading2']))
    forecast_data = [["Timestamp", "Predicted Load (MW)", "Lower CI", "Upper CI"]]
    for p in predictions[:24]: # limit to 24 hours for PDF clarity
        forecast_data.append([p["timestamp"], str(p["predicted_load_mw"]), str(p["lower_bound_mw"]), str(p["upper_bound_mw"])])
        
    t2 = Table(forecast_data)
    t2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor("#3B82F6")),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('GRID', (0, 0), (-1, -1), 1, colors.black)
    ]))
    elements.append(t2)
    
    doc.build(elements)
    
    return FileResponse(temp_file.name, media_type="application/pdf", filename="powercast_report.pdf")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
