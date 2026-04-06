FROM python:3.11-alpine
WORKDIR /app
RUN pip install flask
COPY alert_receiver.py .
EXPOSE 5000
CMD ["python", "alert_receiver.py"]
