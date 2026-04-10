@echo off
cd /d "%~dp0"
echo Current dir: %CD%
git --version
git init
git status
