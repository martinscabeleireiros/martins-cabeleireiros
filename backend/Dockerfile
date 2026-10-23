FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \
    fastapi==0.110.1 \
    uvicorn==0.29.0 \
    motor==3.4.0 \
    pymongo==4.6.3 \
    pydantic==2.6.4 \
    python-dotenv==1.0.1 \
    python-jose[cryptography]==3.3.0
    passlib==1.7.4 \
    email-validator==2.1.0 \
    requests==2.31.0 \
    bcrypt==4.1.2

# Copia todo o conteúdo do repositório
COPY . /app

# Entra na pasta backend onde está o teu código
WORKDIR /app/backend

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "10000"]
