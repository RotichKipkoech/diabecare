import os
from dotenv import load_dotenv
from datetime import timedelta

load_dotenv()


class Config:
    # localhost  config
    MYSQL_HOST = os.getenv('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.getenv('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.getenv('MYSQL_PASSWORD', '@Kenrotich89')
    MYSQL_DB = os.getenv('MYSQL_DB', 'diabecare')
    JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '178b9c9e-1a2b-4c3d-8e7f-9a0b1c2d3e4f')
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # PostgreSQL (Render provides DATABASE_URL)
    # DATABASE_URL = os.getenv('DATABASE_URL')
    # SQLALCHEMY_DATABASE_URI = DATABASE_URL
    # SQLALCHEMY_TRACK_MODIFICATIONS = False
    # JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', '178b9c9e-1a2b-4c3d-8e7f-9a0b1c2d3e4f')
    # JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=24)

    # Africa's Talking SMS
    # AT_USERNAME = os.getenv('AT_USERNAME', 'Diabe')
    # AT_API_KEY = os.getenv('AT_API_KEY', 'atsk_49f46d38f738ca2fc7ddf75bc74d2edd191b1c85264ee6783c57c610c246e4005d6096d3')
    # AT_SENDER_ID = os.getenv('AT_SENDER_ID', '')
    # SMS_ENABLED = os.getenv('SMS_ENABLED', 'true').lower() == 'true'

    # TalkSasa SMS
    TALKSASA_URL       = os.getenv('TALKSASA_URL',       'https://bulksms.talksasa.com/api/v3/sms/send')
    TALKSASA_API_KEY   = os.getenv('TALKSASA_API_KEY',   '2711|2Nu2K9QiPqmhwKD4bpauQ6uFm71zPMGpweAJfFMPd2bf6714')
    TALKSASA_SENDER_ID = os.getenv('TALKSASA_SENDER_ID', 'PROCALL')
    SMS_ENABLED        = os.getenv('SMS_ENABLED', 'true').lower() == 'true'