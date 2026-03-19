"use client";

export interface CotizacionItemForm {
  item: number;
  actividadId?: string;
  descripcion: string;
  cantidad: number;
  unidad: string;
  vrUnitario: number;
}

interface ActividadOption {
  id: string;
  nombre: string;
  descripcion: string;
  unidad: string;
  precio: number;
}

interface CotizacionItemsTableProps {
  items: CotizacionItemForm[];
  actividades: ActividadOption[];
  onChange: (items: CotizacionItemForm[]) => void;
}

export default function CotizacionItemsTable({ items, actividades, onChange }: CotizacionItemsTableProps) {
  function updateItem(index: number, patch: Partial<CotizacionItemForm>) {
    const next = items.map((item, idx) => {
      if (idx !== index) {
        return item;
      }

      return { ...item, ...patch };
    });

    onChange(next);
  }

  function applyActividad(index: number, actividadId: string) {
    const actividad = actividades.find((item) => item.id === actividadId);
    if (!actividad) {
      updateItem(index, { actividadId: "" });
      return;
    }

    updateItem(index, {
      actividadId,
      descripcion: actividad.descripcion,
      unidad: actividad.unidad,
      vrUnitario: actividad.precio
    });
  }

  function addItem() {
    onChange([
      ...items,
      {
        item: items.length + 1,
        actividadId: "",
        descripcion: "",
        cantidad: 1,
        unidad: "und",
        vrUnitario: 0
      }
    ]);
  }

  function removeItem(index: number) {
    const next = items.filter((_, idx) => idx !== index).map((item, idx) => ({ ...item, item: idx + 1 }));
    onChange(
      next.length > 0
        ? next
        : [{ item: 1, actividadId: "", descripcion: "", cantidad: 1, unidad: "und", vrUnitario: 0 }]
    );
  }

  return (
    <div className="table-wrapper">
      <table className="data-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Actividad</th>
            <th>Descripción</th>
            <th>Cant.</th>
            <th>Und.</th>
            <th>Vr Unitario</th>
            <th>Vr Total</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => {
            const rowTotal = Number(item.cantidad) * Number(item.vrUnitario);
            return (
              <tr key={`cot-item-${index}`}>
                <td>{item.item}</td>
                <td>
                  <select
                    value={item.actividadId ?? ""}
                    onChange={(event) => applyActividad(index, event.target.value)}
                  >
                    <option value="">Sin actividad</option>
                    {actividades.map((actividad) => (
                      <option value={actividad.id} key={actividad.id}>
                        {actividad.nombre}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    value={item.descripcion}
                    onChange={(event) => updateItem(index, { descripcion: event.target.value })}
                    placeholder="Descripción"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.cantidad}
                    onChange={(event) => updateItem(index, { cantidad: Number(event.target.value) })}
                  />
                </td>
                <td>
                  <input
                    value={item.unidad}
                    onChange={(event) => updateItem(index, { unidad: event.target.value })}
                    placeholder="Und."
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.vrUnitario}
                    onChange={(event) => updateItem(index, { vrUnitario: Number(event.target.value) })}
                  />
                </td>
                <td>{rowTotal.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</td>
                <td>
                  <button type="button" onClick={() => removeItem(index)} className="ghost-btn">
                    Quitar
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <button type="button" onClick={addItem} className="ghost-btn" style={{ marginTop: "0.65rem" }}>
        + Agregar ítem
      </button>
    </div>
  );
}
