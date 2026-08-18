import { useRef, useState } from 'react'

const VIEWPORT = 260
const OUTPUT_SIZE = 400

export default function AvatarCropper({ file, onCancel, onConfirm }) {
  const imgRef = useRef(null)
  const objectUrlRef = useRef(URL.createObjectURL(file))
  const dragState = useRef(null)

  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 })
  const [imgLoaded, setImgLoaded] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [saving, setSaving] = useState(false)

  const baseScale =
    naturalSize.w && naturalSize.h ? Math.max(VIEWPORT / naturalSize.w, VIEWPORT / naturalSize.h) : 1
  const displayScale = baseScale * zoom

  function clampOffset(next, currentZoom = zoom) {
    const scale = baseScale * currentZoom
    const dispW = naturalSize.w * scale
    const dispH = naturalSize.h * scale
    const maxX = Math.max(0, (dispW - VIEWPORT) / 2)
    const maxY = Math.max(0, (dispH - VIEWPORT) / 2)
    return {
      x: Math.min(maxX, Math.max(-maxX, next.x)),
      y: Math.min(maxY, Math.max(-maxY, next.y)),
    }
  }

  function handleImgLoad(e) {
    setNaturalSize({ w: e.target.naturalWidth, h: e.target.naturalHeight })
    setImgLoaded(true)
  }

  function handlePointerDown(e) {
    dragState.current = { startX: e.clientX, startY: e.clientY, origOffset: offset }
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  function handlePointerMove(e) {
    if (!dragState.current) return
    const dx = e.clientX - dragState.current.startX
    const dy = e.clientY - dragState.current.startY
    setOffset(clampOffset({ x: dragState.current.origOffset.x + dx, y: dragState.current.origOffset.y + dy }))
  }
  function handlePointerUp() {
    dragState.current = null
  }
  function handleZoomChange(e) {
    const newZoom = Number(e.target.value)
    setZoom(newZoom)
    setOffset((prev) => clampOffset(prev, newZoom))
  }

  function handleConfirm() {
    setSaving(true)
    const sourceSize = VIEWPORT / displayScale
    let sx = naturalSize.w / 2 - sourceSize / 2 - offset.x / displayScale
    let sy = naturalSize.h / 2 - sourceSize / 2 - offset.y / displayScale
    sx = Math.min(Math.max(sx, 0), naturalSize.w - sourceSize)
    sy = Math.min(Math.max(sy, 0), naturalSize.h - sourceSize)

    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT_SIZE
    canvas.height = OUTPUT_SIZE
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgRef.current, sx, sy, sourceSize, sourceSize, 0, 0, OUTPUT_SIZE, OUTPUT_SIZE)

    canvas.toBlob(
      (blob) => {
        onConfirm(blob)
      },
      'image/png',
      0.92
    )
  }

  // Posição final: centraliza o topo-esquerdo da imagem de forma que o
  // CENTRO da imagem escalada fique no centro do viewport + o offset do
  // arraste. transform-origin fica em 0 0 pra facilitar essa conta.
  const centerX = VIEWPORT / 2 + offset.x
  const centerY = VIEWPORT / 2 + offset.y
  const translateX = centerX - (naturalSize.w * displayScale) / 2
  const translateY = centerY - (naturalSize.h * displayScale) / 2

  return (
    <div className="modal-overlay">
      <div className="modal-card" style={{ maxWidth: 360 }}>
        <h3 style={{ marginBottom: 16 }}>Ajustar foto</h3>

        <div
          className="cropper-viewport"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          <img
            ref={imgRef}
            src={objectUrlRef.current}
            alt=""
            onLoad={handleImgLoad}
            draggable={false}
            className="cropper-image"
            style={{
              width: naturalSize.w,
              height: naturalSize.h,
              transform: `translate(${translateX}px, ${translateY}px) scale(${displayScale})`,
            }}
          />
        </div>

        <input
          type="range"
          min="1"
          max="3"
          step="0.01"
          value={zoom}
          onChange={handleZoomChange}
          className="cropper-zoom"
          disabled={!imgLoaded}
        />

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn--ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button type="button" className="btn btn--primary" onClick={handleConfirm} disabled={!imgLoaded || saving}>
            {saving ? 'Salvando…' : 'Usar essa foto'}
          </button>
        </div>
      </div>
    </div>
  )
}