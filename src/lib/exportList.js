function describeItem(item) {
  if (item.item_type === 'track') {
    return { title: item.tracks?.name, subtitle: item.tracks?.albums?.artists?.name }
  }
  if (item.item_type === 'album') {
    return { title: item.albums?.name, subtitle: item.albums?.artists?.name }
  }
  return { title: item.artists?.name, subtitle: 'Artista' }
}

/** Monta um texto simples com a lista, pronto pra copiar/colar. */
export function buildListText(list) {
  const items = [...list.list_items].sort((a, b) => a.position - b.position)
  const lines = [list.title, '']
  items.forEach((item, i) => {
    const { title, subtitle } = describeItem(item)
    lines.push(`${i + 1}. ${title}${subtitle ? ' — ' + subtitle : ''}`)
  })
  lines.push('', 'Feito no Musgas')
  return lines.join('\n')
}

/** Gera uma imagem PNG da lista (só texto/formas, sem imagens externas —
 * evita problemas de CORS ao exportar o canvas) e dispara o download. */
export function downloadListAsImage(list) {
  const items = [...list.list_items].sort((a, b) => a.position - b.position)
  const visible = items.slice(0, 12)
  const rowHeight = 46
  const width = 800
  const height = 150 + visible.length * rowHeight + 50

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#17141b'
  ctx.fillRect(0, 0, width, height)

  ctx.fillStyle = '#e8a33d'
  ctx.fillRect(0, 0, width, 6)

  ctx.fillStyle = '#f1ecf5'
  ctx.font = 'bold 32px sans-serif'
  ctx.fillText(list.title, 40, 70)

  ctx.fillStyle = '#a89bb8'
  ctx.font = '15px sans-serif'
  ctx.fillText(`${items.length} item(ns) · musgas`, 40, 100)

  let y = 150
  visible.forEach((item, i) => {
    const { title, subtitle } = describeItem(item)

    ctx.fillStyle = '#e8a33d'
    ctx.font = 'bold 16px monospace'
    ctx.fillText(String(i + 1).padStart(2, '0'), 40, y)

    ctx.fillStyle = '#f1ecf5'
    ctx.font = '600 17px sans-serif'
    ctx.fillText((title || '').slice(0, 55), 80, y)

    ctx.fillStyle = '#766c85'
    ctx.font = '13px sans-serif'
    ctx.fillText((subtitle || '').slice(0, 65), 80, y + 18)

    y += rowHeight
  })

  if (items.length > visible.length) {
    ctx.fillStyle = '#766c85'
    ctx.font = 'italic 14px sans-serif'
    ctx.fillText(`+ ${items.length - visible.length} mais…`, 80, y)
  }

  const link = document.createElement('a')
  const safeName = list.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'lista'
  link.download = `${safeName}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}