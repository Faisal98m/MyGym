from flask import Flask
from db import init_db, seed_programme
from routes import bp

app = Flask(__name__)
app.register_blueprint(bp)

with app.app_context():
    init_db()
    seed_programme()

if __name__ == "__main__":
    app.run(debug=True)
