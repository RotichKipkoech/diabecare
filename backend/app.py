from flask import Flask, app, request as flask_request, jsonify
from config import Config
from extensions import db, migrate, jwt
from flask_cors import CORS
from flask_swagger_ui import get_swaggerui_blueprint
from scheduler import start_scheduler
from werkzeug.middleware.proxy_fix import ProxyFix
import os


def create_app():
    app = Flask(__name__)
    # Tell Flask it's behind Render's reverse proxy.
    # x_for=1 means trust 1 proxy hop for the real IP in X-Forwarded-For.
    app.wsgi_app = ProxyFix(app.wsgi_app, x_for=2, x_proto=2, x_host=1)

    # Database config
    from urllib.parse import quote_plus
    # password = quote_plus(Config.MYSQL_PASSWORD)
    # app.config['SQLALCHEMY_DATABASE_URI'] = (
    #     f"mysql+mysqlconnector://{Config.MYSQL_USER}:{password}"
    #     f"@{Config.MYSQL_HOST}/{Config.MYSQL_DB}"
    # )

    database_url = os.getenv("DATABASE_URL")

# Fix for postgres URL (Render uses postgres:// but SQLAlchemy needs postgresql://)
    if database_url and database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['JWT_SECRET_KEY'] = Config.JWT_SECRET_KEY
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = Config.JWT_ACCESS_TOKEN_EXPIRES

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)

    # ── Token blocklist — rejects blacklisted JWTs on every request ──
    from models import TokenBlocklist as _TBL

    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        jti = jwt_payload.get('jti')
        if not jti:
            return False
        return _TBL.is_blocked(jti)

    @jwt.revoked_token_loader
    def revoked_token_response(jwt_header, jwt_payload):
        from flask import jsonify as _j
        return _j({'error': 'Session expired. Please log in again.'}), 401

    CORS(
    app,
    origins=["http://localhost:8080", "http://localhost:5173", "https://daibecare.netlify.app"],
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
    supports_credentials=True
)

    # Import models so Alembic can detect them
    import models 

    # Register blueprints
    from routes.auth import auth_bp
    from routes.patients import patients_bp
    from routes.medications import medications_bp
    from routes.appointments import appointments_bp
    from routes.stats import stats_bp
    from routes.notifications import notifications_bp
    from routes.features import features_bp
    from routes.sms_logs import sms_logs_bp
    from routes.broadcast import broadcast_bp

    

    app.register_blueprint(auth_bp, url_prefix='/api/auth')
    app.register_blueprint(patients_bp, url_prefix='/api/patients')
    app.register_blueprint(medications_bp, url_prefix='/api/medications')
    app.register_blueprint(appointments_bp, url_prefix='/api/appointments')
    app.register_blueprint(notifications_bp, url_prefix='/api/notifications')   
    app.register_blueprint(stats_bp, url_prefix='/api/stats')
    app.register_blueprint(features_bp, url_prefix='/api/features')
    app.register_blueprint(sms_logs_bp, url_prefix='/api/sms')
    app.register_blueprint(broadcast_bp, url_prefix='/api/broadcast')

    # ── Swagger UI ─────────────────────────────────────
    SWAGGER_URL = '/swagger'
    API_SPEC_URL = '/api/swagger.json'

    swagger_bp = get_swaggerui_blueprint(
        SWAGGER_URL,
        API_SPEC_URL,
        config={'app_name': 'DiabeCare API'}
    )
    app.register_blueprint(swagger_bp, url_prefix=SWAGGER_URL)

    @app.route('/api/swagger.json')
    def swagger_spec():
        return app.send_static_file('swagger.json')

    @app.route('/api/health', methods=['GET'])
    def health():
        return {'status': 'ok', 'service': 'DiabeCare API'}

    # ── SMS Toggle API (Admin only) ────────────────────
    from flask_jwt_extended import jwt_required as _jr, get_jwt as _gj
    import config as _cfg

    @app.route('/api/sms/status', methods=['GET'])
    @_jr()
    def sms_status():
        from flask import jsonify as _j
        return _j({'sms_enabled': _cfg.Config.SMS_ENABLED}), 200

    @app.route('/api/sms/toggle', methods=['POST'])
    @_jr()
    def sms_toggle():
        from flask import jsonify as _j, request as _r
        if _gj().get('role') != 'admin':
            return _j({'error': 'Admin only'}), 403
        data = _r.get_json() or {}
        enabled = data.get('enabled', not _cfg.Config.SMS_ENABLED)
        _cfg.Config.SMS_ENABLED = bool(enabled)
        st = 'enabled' if enabled else 'disabled'
        return _j({'message': f'SMS {st}', 'sms_enabled': _cfg.Config.SMS_ENABLED}), 200

    # ── Start background scheduler ─────────────────────
    # SMS Test Endpoint (Admin only)
    @app.route("/api/sms/test", methods=["POST"])
    @_jr()
    def sms_test():
        from flask import request as _r2, jsonify as _j2
        from sms import send_sms as _ss
        if _gj().get("role") != "admin":
            return _j2({"error": "Admin only"}), 403
        data = _r2.get_json() or {}
        phone = data.get("phone", "")
        if not phone:
            return _j2({"error": "phone required"}), 400
        result = _ss(phone, "DiabeCare SMS test. If received, SMS is working!")
        return _j2({"sent": result, "sms_enabled": _cfg.Config.SMS_ENABLED}), 200

    start_scheduler(app)

    # ── Auto-create default admin on first run ─────────────────────
    with app.app_context():
        try:
            from models import User as _User
            import bcrypt as _bcrypt

            exists = _User.query.filter(
                (_User.username == 'admin') | (_User.email == 'admin@diabecare.com')
            ).first()

            if not exists:
                _hash = _bcrypt.hashpw('admin123'.encode(), _bcrypt.gensalt()).decode()
                default_admin = _User(
                    username='admin',
                    email='admin@diabecare.com',
                    password_hash=_hash,
                    role='admin',
                    full_name='System Administrator',
                    phone='0725761234',
                )
                db.session.add(default_admin)
                db.session.commit()
                import logging as _lg
                _lg.getLogger(__name__).info('[Seed] Default admin created — username: admin, password: admin123')
            else:
                import logging as _lg
                _lg.getLogger(__name__).info('[Seed] Default admin already exists — skipping')
        except Exception as _e:
            import logging as _lg
            _lg.getLogger(__name__).warning(f'[Seed] Could not seed admin: {_e}')

    return app


app = create_app()

if __name__ == '__main__':
    app.run(debug=True, port=5000)