FROM python:3.12-slim
WORKDIR /app
COPY pricer/ ./pricer/
RUN pip install --no-cache-dir fastapi uvicorn yfinance requests
CMD ["uvicorn", "pricer.main:app", "--host", "0.0.0.0", "--port", "8001"]
