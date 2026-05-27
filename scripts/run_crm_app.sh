#!/bin/zsh

cd "/Users/harun/Library/Mobile Documents/com~apple~CloudDocs/CRM_Project_Dealer"
source .venv/bin/activate

exec uvicorn app.main:app --host 127.0.0.1 --port 8001
