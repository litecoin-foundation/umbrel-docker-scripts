FROM python:3.10-slim

WORKDIR /app

COPY . .

RUN pip install --no-cache-dir flask flask-cors requests

EXPOSE 5000

CMD ["python", "app.py"]
