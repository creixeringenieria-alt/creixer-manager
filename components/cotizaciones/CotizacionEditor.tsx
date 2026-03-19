"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import CotizacionItemsTable, { type CotizacionItemForm } from "@/components/cotizaciones/CotizacionItemsTable";
import CotizacionPreview from "@/components/cotizaciones/CotizacionPreview";

export interface OptionItem {
  id: string;
  label: string;
}

interface AiuClienteConfig {
  pctAdministracion: number;
  pctImprevisto: number;
  pctUtilidad: number;
  pctIvaUtilidad: number;
  aplicaIva: boolean;
}

interface FotoDisponible {
  id: string;
  requerimientoId: string;
  storagePath: string;
  descripcion: string;
  origen: "reporte_visita";
}

interface FotoSeleccionada {
  key: string;
  storage_path: string;
  descripcion: string;
  orden: number;
  origen: "manual" | "reporte_visita";
  reporte_visita_foto_id: string | null;
}

interface CotizacionEditorProps {
  mode: "create" | "edit";
  submitLabel: string;
  submitAction: (formData: FormData) => void;
  canAprobarInternamente?: boolean;
  documentPath?: string;
  defaults: {
    cotizacionId?: string;
    codigoCotizacion: string;
    clienteId: string;
    inmuebleId: string;
    requerimientoId: string;
    fechaCotizacion: string;
    contactoNombre: string;
    contactoTelefono: string;
    validaHasta: string;
    empresaNombre: string;
    logoUrl: string;
    marcaAguaTexto: string;
    marcaAguaUrl: string;
    direccion: string;
    pctAdministracion: number;
    pctImprevisto: number;
    pctUtilidad: number;
    pctIvaUtilidad: number;
    aplicaIvaUtilidad: boolean;
    secciones: Record<string, string>;
    items: CotizacionItemForm[];
    selectedFotos: FotoSeleccionada[];
  };
  options: {
    clientes: OptionItem[];
    inmuebles: OptionItem[];
    requerimientos: OptionItem[];
    aiuConfigByCliente: Record<string, AiuClienteConfig>;
    visitaFotosDisponibles: FotoDisponible[];
    actividades: Array<{
      id: string;
      nombre: string;
      descripcion: string;
      unidad: string;
      precio: number;
    }>;
  };
}

const sectionDefs = [
  { key: "introduccion", label: "Introducción" },
  { key: "objetivo_general", label: "Objetivo general" },
  { key: "objetivos_especificos", label: "Objetivos específicos" },
  { key: "diagnostico_preliminar", label: "Diagnóstico preliminar" },
  { key: "alcance", label: "Alcance de los trabajos" },
  { key: "notas_importantes", label: "Nota importante" },
  { key: "tiempo_ejecucion", label: "Plazo de ejecución" },
  { key: "garantia", label: "Garantía" },
  { key: "forma_pago", label: "Forma de pago" },
  { key: "firma_final", label: "Firma final" }
] as const;

function nextOrder(fotos: FotoSeleccionada[]) {
  if (fotos.length === 0) {
    return 1;
  }

  return Math.max(...fotos.map((foto) => Number(foto.orden) || 0)) + 1;
}

export default function CotizacionEditor({
  mode,
  submitLabel,
  submitAction,
  defaults,
  options,
  canAprobarInternamente = false,
  documentPath
}: CotizacionEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const [codigoCotizacion, setCodigoCotizacion] = useState(defaults.codigoCotizacion);
  const [clienteId, setClienteId] = useState(defaults.clienteId);
  const [inmuebleId, setInmuebleId] = useState(defaults.inmuebleId);
  const [requerimientoId, setRequerimientoId] = useState(defaults.requerimientoId);
  const [fechaCotizacion, setFechaCotizacion] = useState(defaults.fechaCotizacion);
  const [empresaNombre, setEmpresaNombre] = useState(defaults.empresaNombre);
  const [logoUrl, setLogoUrl] = useState(defaults.logoUrl);
  const [marcaAguaTexto, setMarcaAguaTexto] = useState(defaults.marcaAguaTexto);
  const [marcaAguaUrl, setMarcaAguaUrl] = useState(defaults.marcaAguaUrl);
  const [direccion, setDireccion] = useState(defaults.direccion);

  const [items, setItems] = useState<CotizacionItemForm[]>(
    defaults.items.length > 0
      ? defaults.items
      : [{ item: 1, actividadId: "", descripcion: "", cantidad: 1, unidad: "und", vrUnitario: 0 }]
  );

  const [pctAdministracion, setPctAdministracion] = useState<number>(defaults.pctAdministracion);
  const [pctImprevisto, setPctImprevisto] = useState<number>(defaults.pctImprevisto);
  const [pctUtilidad, setPctUtilidad] = useState<number>(defaults.pctUtilidad);
  const [pctIvaUtilidad, setPctIvaUtilidad] = useState<number>(defaults.pctIvaUtilidad);
  const [aplicaIvaUtilidad, setAplicaIvaUtilidad] = useState<boolean>(defaults.aplicaIvaUtilidad);

  const [secciones, setSecciones] = useState<Record<string, string>>(defaults.secciones);
  const [selectedFotos, setSelectedFotos] = useState<FotoSeleccionada[]>(defaults.selectedFotos ?? []);

  useEffect(() => {
    const config = options.aiuConfigByCliente[clienteId];
    if (!config) {
      return;
    }

    setPctAdministracion(config.pctAdministracion);
    setPctImprevisto(config.pctImprevisto);
    setPctUtilidad(config.pctUtilidad);
    setPctIvaUtilidad(config.pctIvaUtilidad);
    setAplicaIvaUtilidad(config.aplicaIva);
  }, [clienteId, options.aiuConfigByCliente]);

  const fotosDisponibles = useMemo(
    () => options.visitaFotosDisponibles.filter((foto) => foto.requerimientoId === requerimientoId),
    [options.visitaFotosDisponibles, requerimientoId]
  );

  function toggleFotoDisponible(foto: FotoDisponible, checked: boolean) {
    setSelectedFotos((prev) => {
      const exists = prev.some((row) => row.reporte_visita_foto_id === foto.id);

      if (checked && !exists) {
        return [
          ...prev,
          {
            key: `reporte-${foto.id}`,
            storage_path: foto.storagePath,
            descripcion: foto.descripcion ?? "",
            orden: nextOrder(prev),
            origen: "reporte_visita",
            reporte_visita_foto_id: foto.id
          }
        ];
      }

      if (!checked && exists) {
        return prev.filter((row) => row.reporte_visita_foto_id !== foto.id);
      }

      return prev;
    });
  }

  function updateFoto(index: number, patch: Partial<FotoSeleccionada>) {
    setSelectedFotos((prev) =>
      prev.map((foto, idx) => {
        if (idx !== index) {
          return foto;
        }

        return { ...foto, ...patch };
      })
    );
  }

  function removeFoto(index: number) {
    setSelectedFotos((prev) => prev.filter((_, idx) => idx !== index));
  }

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + Number(item.cantidad) * Number(item.vrUnitario), 0),
    [items]
  );

  const valorAdministracion = useMemo(
    () => subtotal * (Number(pctAdministracion) / 100),
    [subtotal, pctAdministracion]
  );
  const valorImprevisto = useMemo(() => subtotal * (Number(pctImprevisto) / 100), [subtotal, pctImprevisto]);
  const valorUtilidad = useMemo(() => subtotal * (Number(pctUtilidad) / 100), [subtotal, pctUtilidad]);
  const valorIva = useMemo(
    () => (aplicaIvaUtilidad ? valorUtilidad * (Number(pctIvaUtilidad) / 100) : 0),
    [aplicaIvaUtilidad, valorUtilidad, pctIvaUtilidad]
  );
  const totalFinal = useMemo(
    () => subtotal + valorAdministracion + valorImprevisto + valorUtilidad + valorIva,
    [subtotal, valorAdministracion, valorImprevisto, valorUtilidad, valorIva]
  );

  const clienteLabel = options.clientes.find((item) => item.id === clienteId)?.label ?? "";
  const inmuebleLabel = options.inmuebles.find((item) => item.id === inmuebleId)?.label ?? "";
  const requerimientoLabel = options.requerimientos.find((item) => item.id === requerimientoId)?.label ?? "";

  return (
    <>
      <section className="card cotizacion-editor-screen">
        <div className="page-header">
          <h2 style={{ margin: 0 }}>{mode === "create" ? "Nueva cotización" : "Editar cotización"}</h2>
          <div className="inline-form">
            <button type="button" className="ghost-btn" onClick={() => setShowPreview((value) => !value)}>
              {showPreview ? "Ocultar vista previa" : "Mostrar vista previa"}
            </button>
            {documentPath ? (
              <Link href={documentPath} className="ghost-btn">
                Abrir documento final (PDF)
              </Link>
            ) : (
              <span className="feedback">Guarda la cotización para habilitar el documento final PDF.</span>
            )}
          </div>
        </div>

        <form action={submitAction} className="form-grid">
          {defaults.cotizacionId ? <input type="hidden" name="cotizacion_id" value={defaults.cotizacionId} /> : null}
          <input type="hidden" name="items_json" value={JSON.stringify(items)} />
          <input type="hidden" name="secciones_json" value={JSON.stringify(secciones)} />
          <input type="hidden" name="selected_fotos_json" value={JSON.stringify(selectedFotos)} />

          <input
            name="codigo_cotizacion"
            value={codigoCotizacion}
            onChange={(event) => setCodigoCotizacion(event.target.value)}
            placeholder="Código de cotización"
          />

          <input
            name="empresa_nombre"
            value={empresaNombre}
            onChange={(event) => setEmpresaNombre(event.target.value)}
            placeholder="Empresa"
          />

          <input name="logo_url" value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="URL logo" />

          <input
            name="marca_agua_texto"
            value={marcaAguaTexto}
            onChange={(event) => setMarcaAguaTexto(event.target.value)}
            placeholder="Marca de agua (texto)"
          />

          <input
            name="marca_agua_url"
            value={marcaAguaUrl}
            onChange={(event) => setMarcaAguaUrl(event.target.value)}
            placeholder="URL marca de agua (archivo)"
          />

          <select name="cliente_id" value={clienteId} onChange={(event) => setClienteId(event.target.value)} required>
            <option value="">Cliente</option>
            {options.clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.label}
              </option>
            ))}
          </select>

          <select name="inmueble_id" value={inmuebleId} onChange={(event) => setInmuebleId(event.target.value)} required>
            <option value="">Inmueble</option>
            {options.inmuebles.map((inmueble) => (
              <option key={inmueble.id} value={inmueble.id}>
                {inmueble.label}
              </option>
            ))}
          </select>

          <select
            name="requerimiento_id"
            value={requerimientoId}
            onChange={(event) => setRequerimientoId(event.target.value)}
            required
          >
            <option value="">Requerimiento relacionado</option>
            {options.requerimientos.map((requerimiento) => (
              <option key={requerimiento.id} value={requerimiento.id}>
                {requerimiento.label}
              </option>
            ))}
          </select>

          <input
            type="date"
            name="fecha_cotizacion"
            value={fechaCotizacion}
            onChange={(event) => setFechaCotizacion(event.target.value)}
          />

          <input name="contacto_nombre" defaultValue={defaults.contactoNombre} placeholder="Contacto" />
          <input name="contacto_telefono" defaultValue={defaults.contactoTelefono} placeholder="Teléfono contacto" />
          <input type="date" name="valida_hasta" defaultValue={defaults.validaHasta} />
          <input
            name="direccion"
            value={direccion}
            onChange={(event) => setDireccion(event.target.value)}
            placeholder="Dirección"
          />

          <div className="span-2">
            {sectionDefs.map((section) => (
              <div key={section.key} style={{ marginBottom: "0.6rem" }}>
                <label>{section.label}</label>
                <textarea
                  value={secciones[section.key] ?? ""}
                  onChange={(event) => setSecciones((prev) => ({ ...prev, [section.key]: event.target.value }))}
                />
              </div>
            ))}
          </div>

          <div className="span-2">
            <h3>Presupuesto estimado</h3>
            <CotizacionItemsTable items={items} actividades={options.actividades} onChange={setItems} />
          </div>

          <div className="span-2 totals-box">
            <div className="aiu-grid">
              <div>
                <label>Administración (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pct_administracion"
                  value={pctAdministracion}
                  onChange={(event) => setPctAdministracion(Number(event.target.value))}
                />
              </div>
              <div>
                <label>Imprevisto (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pct_imprevisto"
                  value={pctImprevisto}
                  onChange={(event) => setPctImprevisto(Number(event.target.value))}
                />
              </div>
              <div>
                <label>Utilidad (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pct_utilidad"
                  value={pctUtilidad}
                  onChange={(event) => setPctUtilidad(Number(event.target.value))}
                />
              </div>
              <div>
                <label>IVA sobre utilidad (%)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  name="pct_iva_utilidad"
                  value={pctIvaUtilidad}
                  onChange={(event) => setPctIvaUtilidad(Number(event.target.value))}
                />
              </div>
            </div>

            <label className="checkbox-row">
              <input
                type="checkbox"
                name="aplica_iva_utilidad"
                value="si"
                checked={aplicaIvaUtilidad}
                onChange={(event) => setAplicaIvaUtilidad(event.target.checked)}
              />
              Aplicar IVA sobre utilidad
            </label>

            <p>Subtotal: {subtotal.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
            <p>Administración: {valorAdministracion.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
            <p>Imprevisto: {valorImprevisto.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
            <p>Utilidad: {valorUtilidad.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
            <p>IVA: {valorIva.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</p>
            <p>
              <strong>Total final: {totalFinal.toLocaleString("es-CO", { maximumFractionDigits: 2 })}</strong>
            </p>
          </div>

          <div className="span-2 card" style={{ marginBottom: 0 }}>
            <h3>Fotos disponibles de visita técnica/reporte</h3>
            {fotosDisponibles.length === 0 ? (
              <p>No hay fotos disponibles para el requerimiento seleccionado.</p>
            ) : (
              <div className="photo-grid">
                {fotosDisponibles.map((foto) => {
                  const checked = selectedFotos.some((row) => row.reporte_visita_foto_id === foto.id);
                  return (
                    <label key={foto.id} className="photo-card">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => toggleFotoDisponible(foto, event.target.checked)}
                      />
                      <span>{foto.storagePath}</span>
                      <small>{foto.descripcion || "Sin descripción"}</small>
                    </label>
                  );
                })}
              </div>
            )}

            <h4 style={{ marginTop: "1rem" }}>Fotos incluidas en la cotización</h4>
            {selectedFotos.length === 0 ? (
              <p>No hay fotos seleccionadas.</p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Origen</th>
                      <th>Ruta</th>
                      <th>Orden</th>
                      <th>Descripción</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFotos.map((foto, index) => (
                      <tr key={foto.key}>
                        <td>{foto.origen}</td>
                        <td>{foto.storage_path}</td>
                        <td>
                          <input
                            type="number"
                            min="1"
                            value={foto.orden}
                            onChange={(event) => updateFoto(index, { orden: Number(event.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            value={foto.descripcion}
                            onChange={(event) => updateFoto(index, { descripcion: event.target.value })}
                            placeholder="Descripción opcional"
                          />
                        </td>
                        <td>
                          <button type="button" className="ghost-btn" onClick={() => removeFoto(index)}>
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h4 style={{ marginTop: "1rem" }}>Agregar fotos manuales</h4>
            <div className="inline-form">
              <input type="file" name="fotos_manuales" multiple accept="image/*" />
              <input name="fotos_manuales_caption" placeholder="Descripción opcional" />
              <input type="number" min="1" name="fotos_manuales_orden_inicial" placeholder="Orden inicial" />
            </div>
          </div>

          <div className="inline-form span-2">
            <button type="submit" name="estado_destino" value="borrador">
              Guardar borrador
            </button>
            <button type="submit" name="estado_destino" value="en_revision_interna">
              Enviar a revisión interna
            </button>
            {mode === "edit" ? (
              <>
                {canAprobarInternamente ? (
                  <>
                    <button type="submit" name="estado_destino" value="aprobada_internamente">
                      Aprobar internamente (Julián)
                    </button>
                    <button type="submit" name="estado_destino" value="enviada">
                      Marcar como enviada
                    </button>
                  </>
                ) : (
                  <p className="feedback">Solo administrador puede aprobar internamente o marcar como enviada.</p>
                )}
                <button type="submit" name="estado_destino" value="ajustes_solicitados">
                  Solicitar ajustes
                </button>
              </>
            ) : null}
          </div>
        </form>
      </section>

      {showPreview ? (
        <CotizacionPreview
          empresaNombre={empresaNombre}
          logoUrl={logoUrl}
          marcaAguaTexto={marcaAguaTexto}
          marcaAguaUrl={marcaAguaUrl}
          codigoCotizacion={codigoCotizacion}
          fechaCotizacion={fechaCotizacion}
          clienteLabel={clienteLabel}
          inmuebleLabel={inmuebleLabel}
          requerimientoLabel={requerimientoLabel}
          direccion={direccion}
          secciones={secciones}
          subtotal={subtotal}
          valorAdministracion={valorAdministracion}
          valorImprevisto={valorImprevisto}
          valorUtilidad={valorUtilidad}
          valorIva={valorIva}
          totalFinal={totalFinal}
          fotos={selectedFotos.map((foto) => ({
            storage_path: foto.storage_path,
            descripcion: foto.descripcion,
            orden: foto.orden
          }))}
        />
      ) : null}
    </>
  );
}
