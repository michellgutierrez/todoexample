from flask import Flask, request, jsonify, render_template
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import os

# Inicialización de la aplicación Flask
app = Flask(__name__)

# Configuración de la base de datos (dinámica: local SQLite o PostgreSQL remoto para Railway/Supabase)
db_url = os.environ.get("DATABASE_URL", "sqlite:///todos.db")
# Solución de compatibilidad para SQLAlchemy: cambiar 'postgres://' a 'postgresql://' si aplica
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config["SQLALCHEMY_DATABASE_URI"] = db_url
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

# Inicialización de SQLAlchemy para manejar el ORM (mapeo objeto-relacional)
db = SQLAlchemy(app)


# Modelo de la base de datos para los Tareas (Todos)
class Todo(db.Model):
    id = db.Column(db.Integer, primary_key=True)                   # Identificador único autoincremental
    title = db.Column(db.String(300), nullable=False)              # Título de la tarea (máx. 300 caracteres, obligatorio)
    done = db.Column(db.Boolean, default=False)                    # Estado de la tarea (completada o no)
    priority = db.Column(db.String(10), default="medium")          # Prioridad: 'low', 'medium' o 'high'
    due_date = db.Column(db.String(20), nullable=True)             # Fecha límite (opcional)
    position = db.Column(db.Integer, default=0)                    # Posición para el orden de arrastrar y soltar (drag & drop)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)   # Fecha y hora de creación automática en UTC

    # Método para convertir el objeto de la base de datos a un diccionario serializable a JSON
    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "done": self.done,
            "priority": self.priority,
            "due_date": self.due_date,
            "position": self.position,
            "created_at": self.created_at.isoformat(),
        }


# Crea las tablas en la base de datos si aún no existen
with app.app_context():
    db.create_all()


# ── Páginas (Rutas de Plantilla HTML) ────────────────────────────────────────

# Ruta principal que sirve el archivo frontend HTML (index.html)
@app.route("/")
def index():
    return render_template("index.html")


# ── Endpoints de la API REST ──────────────────────────────────────────────────

# Obtener todas las tareas, ordenadas por su posición personalizada y luego por fecha de creación
@app.route("/api/todos", methods=["GET"])
def get_todos():
    todos = Todo.query.order_by(Todo.position.asc(), Todo.created_at.asc()).all()
    return jsonify([t.to_dict() for t in todos])


# Crear una nueva tarea
@app.route("/api/todos", methods=["POST"])
def create_todo():
    data = request.get_json()
    # Validación básica: asegurarse de que el título no esté vacío
    if not data or not data.get("title", "").strip():
        return jsonify({"error": "Title is required"}), 400

    # Obtener el valor máximo de posición actual para ubicar la nueva tarea al final de la lista
    max_pos = db.session.query(db.func.max(Todo.position)).scalar() or 0

    # Crear una nueva instancia del modelo Todo con los datos provistos
    todo = Todo(
        title=data["title"].strip(),
        priority=data.get("priority", "medium"),
        due_date=data.get("due_date") or None,
        position=max_pos + 1,
    )
    db.session.add(todo)   # Agregar la tarea a la sesión de la base de datos
    db.session.commit()    # Confirmar los cambios para guardarlos en el archivo .db
    return jsonify(todo.to_dict()), 201


# Actualizar una tarea existente (título, estado completado, prioridad y/o fecha límite)
@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
def update_todo(todo_id):
    todo = db.get_or_404(Todo, todo_id) # Obtener la tarea o lanzar error 404 si no existe
    data = request.get_json()

    # Actualizar solo los campos que fueron enviados en la petición
    if "title" in data:
        title = data["title"].strip()
        if not title:
            return jsonify({"error": "Title cannot be empty"}), 400
        todo.title = title
    if "done" in data:
        todo.done = bool(data["done"])
    if "priority" in data:
        todo.priority = data["priority"]
    if "due_date" in data:
        todo.due_date = data["due_date"] or None

    db.session.commit() # Guardar cambios en la base de datos
    return jsonify(todo.to_dict())


# Eliminar una tarea por su ID
@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
def delete_todo(todo_id):
    todo = db.get_or_404(Todo, todo_id)
    db.session.delete(todo) # Eliminar el registro
    db.session.commit()     # Confirmar los cambios
    return jsonify({"ok": True})


# Reordenar las tareas según la disposición dada en el arrastrar y soltar (drag & drop)
@app.route("/api/todos/reorder", methods=["POST"])
def reorder_todos():
    """Espera un cuerpo JSON: { "order": [id1, id2, id3, ...] }"""
    data = request.get_json()
    order = data.get("order", [])
    
    # Actualizar la posición de cada tarea según su nuevo índice en el arreglo
    for position, todo_id in enumerate(order):
        Todo.query.filter_by(id=todo_id).update({"position": position})
    db.session.commit()
    return jsonify({"ok": True})


# Punto de entrada para ejecutar el servidor Flask localmente en el puerto 5000 con modo debug activo
if __name__ == "__main__":
    app.run(debug=True, port=5000)
