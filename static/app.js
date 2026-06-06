/* ═══════════════════════════════════════════════════════════════
   Antigravity Todo — Lógica del Frontend (JavaScript)
   ═══════════════════════════════════════════════════════════════ */

// Ruta raíz para las llamadas a la API REST de tareas
const API = "/api/todos";

// ── Estado de la Aplicación ────────────────────────────────────────────────
let todos   = [];              // Arreglo en memoria con la lista completa de tareas
let filter  = "all";           // Filtro seleccionado: 'all' | 'active' | 'completed'
let sortBy  = "position";      // Criterio de orden: 'position' | 'priority' | 'due_date' | 'created_at'
let editId  = null;            // ID de la tarea que se está editando actualmente (si hay alguna)

// ── Elementos del DOM (Interfaz Gráfica) ────────────────────────────────────
const todoList        = document.getElementById("todo-list");
const addForm         = document.getElementById("add-form");
const todoInput       = document.getElementById("todo-input");
const prioritySelect  = document.getElementById("priority-select");
const dueDateInput    = document.getElementById("due-date-input");
const filterTabs      = document.querySelectorAll(".filter-tab");
const sortSelect      = document.getElementById("sort-select");
const statsLabel      = document.getElementById("stats-label");
const emptyState      = document.getElementById("empty-state");
const clearBtn        = document.getElementById("clear-completed-btn");

// Elementos del Modal de Edición
const editModal       = document.getElementById("edit-modal");
const editInput       = document.getElementById("edit-input");
const editPriority    = document.getElementById("edit-priority");
const editDueDate     = document.getElementById("edit-due-date");
const modalCancel     = document.getElementById("modal-cancel");
const modalSave       = document.getElementById("modal-save");

// ── Funciones Auxiliares de la API ──────────────────────────────────────────
// Realiza solicitudes HTTP (GET, POST, PUT, DELETE) y maneja las cabeceras JSON
async function apiFetch(url, method = "GET", body = null) {
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status}`);
  return res.json();
}

// ── Carga y Renderizado (Dibujado en Pantalla) ──────────────────────────────

// Carga las tareas desde el servidor Flask y luego redibuja la lista
async function loadTodos() {
  todos = await apiFetch(API);
  render();
}

// Retorna la lista de tareas filtrada y ordenada según el estado actual
function sortedFiltered() {
  let list = [...todos];

  // Aplicar filtro de estado (Completadas, Activas o Todas)
  if (filter === "active")    list = list.filter(t => !t.done);
  if (filter === "completed") list = list.filter(t =>  t.done);

  // Aplicar orden seleccionado
  const priority_order = { high: 0, medium: 1, low: 2 }; // Pesos numéricos para las prioridades
  list.sort((a, b) => {
    if (sortBy === "priority") {
      return (priority_order[a.priority] ?? 1) - (priority_order[b.priority] ?? 1);
    }
    if (sortBy === "due_date") {
      const da = a.due_date || "9999-99-99"; // Si no tiene fecha, se manda al final
      const db_ = b.due_date || "9999-99-99";
      return da.localeCompare(db_);
    }
    if (sortBy === "created_at") {
      return new Date(a.created_at) - new Date(b.created_at);
    }
    // Orden predeterminado: por posición personalizada (Drag and Drop)
    return (a.position ?? 999) - (b.position ?? 999);
  });

  return list;
}

// Dibuja los elementos HTML en la página según la lista de tareas
function render() {
  const list = sortedFiltered();

  // Actualizar estadísticas (Tareas pendientes)
  const remaining = todos.filter(t => !t.done).length;
  statsLabel.textContent = `${remaining} tarea${remaining !== 1 ? "s" : ""} pendiente${remaining !== 1 ? "s" : ""}`;

  // Mostrar u ocultar el estado vacío si no hay tareas
  const empty = list.length === 0;
  emptyState.classList.toggle("hidden", !empty);
  todoList.classList.toggle("hidden", empty);

  // Limpiar la lista existente y renderizar los nuevos elementos
  todoList.innerHTML = "";
  list.forEach(todo => todoList.appendChild(buildItem(todo)));
}

// Crea la estructura de elementos HTML para un elemento de tarea individual
function buildItem(todo) {
  const li = document.createElement("li");
  li.className = `todo-item${todo.done ? " done-item" : ""}`;
  li.dataset.id = todo.id;
  li.dataset.priority = todo.priority;

  // Si tiene fecha límite, renderizar el distintivo de fecha
  const duePart = todo.due_date ? buildDuePart(todo.due_date) : "";

  li.innerHTML = `
    <!-- Manejador para arrastrar la tarea -->
    <div class="drag-handle" title="Arrastrar para reordenar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
        <line x1="4" y1="7"  x2="20" y2="7"/>
        <line x1="4" y1="12" x2="20" y2="12"/>
        <line x1="4" y1="17" x2="20" y2="17"/>
      </svg>
    </div>
    <!-- Botón de Checkbox para completar/desmarcar -->
    <button class="todo-check${todo.done ? " checked" : ""}" data-id="${todo.id}" title="Marcar completada" aria-label="Marcar tarea ${todo.done ? "incompleta" : "completa"}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </button>
    <!-- Cuerpo de la tarea (Título, Prioridad y Fecha Límite) -->
    <div class="todo-body">
      <span class="todo-title" title="${escapeHtml(todo.title)}">${escapeHtml(todo.title)}</span>
      <div class="todo-meta-line">
        <span class="todo-priority-badge badge-${todo.priority}">${todo.priority}</span>
        ${duePart}
      </div>
    </div>
    <!-- Acciones de edición y borrado -->
    <div class="todo-actions">
      <button class="icon-btn edit-btn" data-id="${todo.id}" title="Editar tarea" aria-label="Editar tarea">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="icon-btn delete-btn" data-id="${todo.id}" title="Eliminar tarea" aria-label="Eliminar tarea">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6M14 11v6"/>
          <path d="M9 6V4h6v2"/>
        </svg>
      </button>
    </div>
  `;

  return li;
}

// Da formato visual a la fecha límite y calcula si está vencida
function buildDuePart(dateStr) {
  const today = new Date(); today.setHours(0,0,0,0);
  const due   = new Date(dateStr + "T00:00:00");
  const diff  = Math.ceil((due - today) / 86400000);
  const isOverdue = diff < 0;
  const label = isOverdue
    ? `Vencida por ${Math.abs(diff)}d`
    : diff === 0 ? "Hoy"
    : diff === 1 ? "Mañana"
    : `${dateStr}`;
  return `<span class="todo-due${isOverdue ? " overdue" : ""}">
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
    ${label}
  </span>`;
}

// Función auxiliar para escapar código HTML malicioso y prevenir XSS
function escapeHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Arrastrar y Soltar (SortableJS) ──────────────────────────────────────────
let sortable = null;

// Inicializa el comportamiento de ordenación por arrastre en la lista
function initSortable() {
  if (sortable) sortable.destroy(); // Destruir la instancia existente antes de volver a crearla
  sortable = Sortable.create(todoList, {
    animation: 180,
    easing: "cubic-bezier(.4,0,.2,1)",
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    dragClass: "sortable-drag",
    handle: ".drag-handle, .todo-item",   // Hace que toda la fila sea arrastrable, pero el icono es preferido
    filter: ".icon-btn, .todo-check",     // Previene que se inicie el arrastre desde los botones de acción
    onEnd: async (evt) => {
      if (evt.oldIndex === evt.newIndex) return; // No hacer nada si la posición no cambió
      
      // Recolectar la nueva secuencia de IDs directamente del DOM
      const orderedIds = [...todoList.querySelectorAll(".todo-item")].map(el => Number(el.dataset.id));
      
      // Actualización local optimista para evitar demoras visuales
      const lookup = Object.fromEntries(todos.map(t => [t.id, t]));
      orderedIds.forEach((id, i) => { if (lookup[id]) lookup[id].position = i; });
      todos = orderedIds.map(id => lookup[id]).filter(Boolean);
      
      // Enviar el nuevo orden al servidor Flask
      await apiFetch(`${API}/reorder`, "POST", { order: orderedIds });
    },
  });
}

// Observa cambios en el DOM de la lista para re-inicializar SortableJS cuando sea necesario
const listObserver = new MutationObserver(() => {
  if (sortBy === "position") initSortable();
});
listObserver.observe(todoList, { childList: true });

// ── Delegación de Eventos (Acciones sobre elementos de la lista) ─────────────
todoList.addEventListener("click", async (e) => {
  const checkBtn  = e.target.closest(".todo-check");
  const editBtn   = e.target.closest(".edit-btn");
  const deleteBtn = e.target.closest(".delete-btn");

  // Al presionar el checkbox para completar/marcar incompleta una tarea
  if (checkBtn) {
    const id   = Number(checkBtn.dataset.id);
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const updated = await apiFetch(`${API}/${id}`, "PUT", { done: !todo.done });
    Object.assign(todo, updated);
    render();
    return;
  }

  // Al presionar el botón de editar
  if (editBtn) {
    const id = Number(editBtn.dataset.id);
    openEditModal(id);
    return;
  }

  // Al presionar el botón de eliminar
  if (deleteBtn) {
    const id = Number(deleteBtn.dataset.id);
    await deleteTodo(id);
    return;
  }
});

// ── Formulario de Agregar Tarea ─────────────────────────────────────────────
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = todoInput.value.trim();
  if (!title) return;

  // Enviar los datos de la nueva tarea al backend
  const newTodo = await apiFetch(API, "POST", {
    title,
    priority: prioritySelect.value,
    due_date: dueDateInput.value || null,
  });

  // Agregar al arreglo local y redibujar
  todos.push(newTodo);
  todoInput.value = "";
  dueDateInput.value = "";
  prioritySelect.value = "medium";
  render();
  todoInput.focus();
});

// ── Pestañas de Filtros (Todas, Activas, Completadas) ────────────────────────
filterTabs.forEach(tab => {
  tab.addEventListener("click", () => {
    filter = tab.dataset.filter;
    filterTabs.forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    render();
  });
});

// ── Selector de Ordenamiento ─────────────────────────────────────────────────
sortSelect.addEventListener("change", () => {
  sortBy = sortSelect.value;
  render();
});

// ── Limpiar Tareas Completadas ───────────────────────────────────────────────
clearBtn.addEventListener("click", async () => {
  const completed = todos.filter(t => t.done);
  if (completed.length === 0) return;
  // Elimina del servidor todas las completadas en paralelo
  await Promise.all(completed.map(t => apiFetch(`${API}/${t.id}`, "DELETE")));
  // Limpia el estado local y renderiza
  todos = todos.filter(t => !t.done);
  render();
});

// ── Eliminación de Tareas con Animación ──────────────────────────────────────
async function deleteTodo(id) {
  // Animación de salida (desvanecimiento y deslizamiento)
  const el = todoList.querySelector(`[data-id="${id}"]`);
  if (el) {
    el.style.transition = "all .2s ease";
    el.style.opacity = "0";
    el.style.transform = "translateX(16px) scale(.97)";
    await new Promise(r => setTimeout(r, 200)); // Espera a que termine la animación css
  }
  await apiFetch(`${API}/${id}`, "DELETE");
  todos = todos.filter(t => t.id !== id);
  render();
}

// ── Ventana Modal para Editar Tareas ──────────────────────────────────────────
// Abre la ventana modal y rellena los campos con la información actual de la tarea
function openEditModal(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) return;
  editId = id;
  editInput.value       = todo.title;
  editPriority.value    = todo.priority;
  editDueDate.value     = todo.due_date || "";
  editModal.classList.remove("hidden");
  requestAnimationFrame(() => editInput.focus());
}

// Cierra la ventana modal de edición y limpia el ID seleccionado
function closeEditModal() {
  editModal.classList.add("hidden");
  editId = null;
}

modalCancel.addEventListener("click", closeEditModal);

// Cerrar el modal al hacer clic en el fondo oscurecido
editModal.addEventListener("click", (e) => {
  if (e.target === editModal) closeEditModal();
});

// Cerrar el modal al presionar la tecla Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !editModal.classList.contains("hidden")) closeEditModal();
});

// Guardar los cambios editados enviando una petición PUT al backend
modalSave.addEventListener("click", async () => {
  if (!editId) return;
  const title = editInput.value.trim();
  if (!title) { editInput.focus(); return; }

  const updated = await apiFetch(`${API}/${editId}`, "PUT", {
    title,
    priority: editPriority.value,
    due_date: editDueDate.value || null,
  });

  // Reemplazar la tarea actualizada en el estado local, cerrar modal y redibujar
  const idx = todos.findIndex(t => t.id === editId);
  if (idx !== -1) todos[idx] = updated;
  closeEditModal();
  render();
});

// Guardar los cambios presionando Enter dentro del campo de texto de edición
editInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") modalSave.click();
});

// ── Inicialización del Proyecto ─────────────────────────────────────────────
loadTodos(); // Llama a la carga inicial de tareas al arrancar la aplicación
