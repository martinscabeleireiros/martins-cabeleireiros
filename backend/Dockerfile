import certifi
from motor.motor_asyncio import AsyncIOMotorClient
import os

MONGO_URL = os.environ.get("MONGO_URL")

# Isto diz ao Python para usar os certificados seguros do Render/certifi
client = AsyncIOMotorClient(MONGO_URL, tlsCAFile=certifi.where())
db = client.get_default_database()
