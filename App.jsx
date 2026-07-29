import { useEffect, useRef, useState } from 'react'
import { Chart, registerables } from 'chart.js'
import { supabase } from './supabaseClient'
import './App.css'

Chart.register(...registerables)
const GST_RATE = 0.10
const money = (n) => '$' + (Number(n) || 0).toFixed(2)

export default function App() {
  const [view, setView] = useState('register')
  const [businesses, setBusinesses] = useState([])
  const [bizId, setBizId] = useState(null)

  useEffect(() => { loadBusinesses() }, [])

  async function loadBusinesses() {
    const { data, error } = await supabase.from('businesses').select('*').order('created_at')
    if (error) { console.error(error); return }
    setBusinesses(data)
    if (data.length && !bizId) setBizId(data[0].id)
  }

  async function addBusiness() {
    const name = prompt('Business name?')
    if (!name) return
    const { error } = await supabase.from('businesses').insert({ name })
    if (error) alert(error.message)
    loadBusinesses()
  }

  async function deleteBusiness() {
    if (!currentBiz) return
    const sure = confirm(`Delete "${currentBiz.name}" and everything in it ‚Äî all its products, sales, and customers? This can't be undone.`)
    if (!sure) return
    const { error } = await supabase.from('businesses').delete().eq('id', bizId)
    if (error) { alert(error.message); return }
    setBizId(null)
    loadBusinesses()
  }

  const currentBiz = businesses.find(b => b.id === bizId)

  return (
    <div className="app">
      <header>
        <div className="brandrow">
          <div className="brand">Market Day <span>register</span></div>
          <div className="biz-switch">
            <select value={bizId || ''} onChange={e => setBizId(e.target.value)}>
              {businesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
            <button className="add-biz" onClick={addBusiness}>+ New business</button>
            {currentBiz && <button className="add-biz danger" onClick={deleteBusiness}>Delete business</button>}
          </div>
        </div>
        <nav className="tabs">
          {['register', 'stock', 'analytics', 'customers'].map(v => (
            <button key={v} className={view === v ? 'active' : ''} onClick={() => setView(v)}>
              {v === 'register' ? 'Register' : v === 'stock' ? 'Stock Setup' : v === 'analytics' ? 'Sales Analytics' : 'Customer Profiles'}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {!bizId && <p>Add a business to get started.</p>}
        {bizId && view === 'register' && <RegisterView bizId={bizId} bizName={currentBiz?.name} />}
        {bizId && view === 'stock' && <StockView bizId={bizId} bizName={currentBiz?.name} />}
        {bizId && view === 'analytics' && <AnalyticsView bizId={bizId} />}
        {bizId && view === 'customers' && <CustomersView bizId={bizId} />}
      </main>
    </div>
  )
}

/* ---------------- REGISTER ---------------- */
function RegisterView({ bizId, bizName }) {
  const [products, setProducts] = useState([])
  const [cart, setCart] = useState([])
  const [cash, setCash] = useState('')

  useEffect(() => { loadProducts() }, [bizId])

  async function loadProducts() {
    const { data } = await supabase.from('products').select('*').eq('business_id', bizId).order('created_at')
    setProducts(data || [])
  }

  function addToCart(p) {
    setCart(prev => {
      const existing = prev.find(c => c.id === p.id)
      if (existing) return prev.map(c => c.id === p.id ? { ...c, qty: c.qty + 1 } : c)
      return [...prev, { id: p.id, name: p.name, price: p.price, qty: 1 }]
    })
  }
  function removeFromCart(id) { setCart(prev => prev.filter(c => c.id !== id)) }

  const totalIncl = cart.reduce((s, c) => s + c.qty * c.price, 0)
  const gst = totalIncl - totalIncl / (1 + GST_RATE)
  const given = parseFloat(cash) || 0
  const change = given - totalIncl

  async function completeSale() {
    if (cart.length === 0) { alert('Add at least one product first.'); return }
    const { data: sale, error } = await supabase.from('sales').insert({
      business_id: bizId,
      subtotal: totalIncl - gst,
      gst_amount: gst,
      total: totalIncl,
      cash_given: given,
      change_given: change > 0 ? change : 0
    }).select().single()
    if (error) { alert(error.message); return }

    const items = cart.map(c => ({ sale_id: sale.id, product_id: c.id, product_name: c.name, qty: c.qty, unit_price: c.price }))
    await supabase.from('sale_items').insert(items)

    for (const c of cart) {
      const p = products.find(pr => pr.id === c.id)
      if (p) await supabase.from('products').update({ stock_qty: Math.max(0, p.stock_qty - c.qty) }).eq('id', c.id)
    }

    setCart([]); setCash('')
    loadProducts()
    alert('Sale complete.')
  }

  return (
    <section>
      <p className="eyebrow">Till ¬∑ {bizName}</p>
      <h2 className="section-title">Ring up an order</h2>
      <div className="register-grid">
        <div className="product-grid">
          {products.map(p => (
            <button key={p.id} className="product-tile" onClick={() => addToCart(p)}>
              <div className="swatch">{p.image_url ? <img src={p.image_url} alt="" /> : 'üõçÔ∏è'}</div>
              <div className="p-name">{p.name}</div>
              <div className="p-price">{money(p.price)}</div>
              <div className="p-stock">{p.stock_qty} in stock</div>
            </button>
          ))}
          {products.length === 0 && <p>No products yet ‚Äî add some in Stock Setup.</p>}
        </div>

        <div className="receipt">
          <div className="receipt-head"><span>Current order</span></div>
          <div className="receipt-body">
            {cart.length === 0 && <div className="empty-cart">Tap a product to add it</div>}
            {cart.map(c => (
              <div className="rline" key={c.id}>
                <span><span className="qty">{c.qty}√ó</span>{c.name}</span>
                <span>{money(c.qty * c.price)} <button onClick={() => removeFromCart(c.id)}>‚úï</button></span>
              </div>
            ))}
          </div>
          <div className="totals">
            <div className="trow"><span>Subtotal</span><span>{money(totalIncl - gst)}</span></div>
            <div className="trow gst"><span>GST (10%, incl.)</span><span>{money(gst)}</span></div>
            <div className="trow grand"><span>Total due</span><span>{money(totalIncl)}</span></div>
          </div>
          <div className="cash-row">
            <label>Cash received</label>
            <input type="number" value={cash} onChange={e => setCash(e.target.value)} placeholder="0.00" />
            <div className="change-out"><span>Change to give</span><span>{money(change > 0 ? change : 0)}</span></div>
          </div>
          <button className="btn-complete" onClick={completeSale}>Complete sale</button>
        </div>
      </div>
    </section>
  )
}

/* ---------------- STOCK ---------------- */
function StockView({ bizId, bizName }) {
  const [products, setProducts] = useState([])
  const [form, setForm] = useState({ name: '', price: '', cost: '', stock_qty: '', image_url: '' })
  const [uploading, setUploading] = useState(false)

  useEffect(() => { load() }, [bizId])
  async function load() {
    const { data } = await supabase.from('products').select('*').eq('business_id', bizId).order('created_at')
    setProducts(data || [])
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const path = `${bizId}/${Date.now()}-${file.name}`
    const { error } = await supabase.storage.from('product-photos').upload(path, file)
    setUploading(false)
    if (error) { alert('Photo upload failed: ' + error.message + '\n\nCheck the "product-photos" storage bucket has been created ‚Äî see the storage-setup guide.'); return }
    const { data } = supabase.storage.from('product-photos').getPublicUrl(path)
    setForm(f => ({ ...f, image_url: data.publicUrl }))
  }

  async function addProduct(e) {
    e.preventDefault()
    if (!form.name || !form.price) return
    const { error } = await supabase.from('products').insert({
      business_id: bizId, name: form.name, price: parseFloat(form.price),
      cost: parseFloat(form.cost) || 0, stock_qty: parseInt(form.stock_qty) || 0,
      image_url: form.image_url || null
    })
    if (error) alert(error.message)
    setForm({ name: '', price: '', cost: '', stock_qty: '', image_url: '' })
    load()
  }

  async function removeProduct(id) {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  return (
    <section>
      <p className="eyebrow">Inventory ¬∑ {bizName}</p>
      <h2 className="section-title">Products &amp; pricing</h2>
      <form className="stock-form" onSubmit={addProduct}>
        <input placeholder="Product name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <input placeholder="Price $" type="number" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} />
        <input placeholder="Cost $" type="number" step="0.01" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} />
        <input placeholder="Stock qty" type="number" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} />
        <label className="file-btn">
          {uploading ? 'Uploading‚Ä¶' : form.image_url ? 'Photo added ‚úì' : 'Add photo'}
          <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
        </label>
        {form.image_url && <img className="form-thumb" src={form.image_url} alt="" />}
        <button type="submit" className="btn-ghost">+ Add product</button>
      </form>
      <table className="stock-table">
        <thead><tr><th></th><th>Product</th><th>Price</th><th>Cost</th><th>On hand</th><th></th></tr></thead>
        <tbody>
          {products.map(p => (
            <tr key={p.id}>
              <td>{p.image_url ? <img className="row-thumb" src={p.image_url} alt="" /> : <span className="row-thumb placeholder">üõçÔ∏è</span>}</td>
              <td>{p.name}</td><td>{money(p.price)}</td><td>{money(p.cost)}</td>
              <td>{p.stock_qty <= 4 ? <span className="pill low">{p.stock_qty} low</span> : p.stock_qty}</td>
              <td><button className="link-danger" onClick={() => removeProduct(p.id)}>Delete</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/* ---------------- ANALYTICS ---------------- */
function AnalyticsView({ bizId }) {
  const [sales, setSales] = useState([])
  const [items, setItems] = useState([])
  const [range, setRange] = useState('all')
  const hourlyRef = useRef(null)
  const productRef = useRef(null)
  const chartsRef = useRef([])

  useEffect(() => { load() }, [bizId])

  async function load() {
    const { data: s } = await supabase.from('sales').select('*').eq('business_id', bizId).order('sold_at', { ascending: false })
    const saleIds = (s || []).map(x => x.id)
    let its = []
    if (saleIds.length) {
      const { data: i } = await supabase.from('sale_items').select('*').in('sale_id', saleIds)
      its = i || []
    }
    setSales(s || []); setItems(its)
  }

  async function clearSales() {
    const sure = confirm('Delete ALL sales data for this business? Products and customers are kept ‚Äî only the sales history and charts reset. This cannot be undone.')
    if (!sure) return
    await supabase.from('sales').delete().eq('business_id', bizId)
    load()
  }

  const now = new Date()
  const filteredSales = sales.filter(s => {
    if (range === 'all') return true
    const d = new Date(s.sold_at)
    if (range === 'today') return d.toDateString() === now.toDateString()
    if (range === '7d') return now - d <= 7 * 24 * 3600 * 1000
    return true
  })
  const filteredIds = new Set(filteredSales.map(s => s.id))
  const filteredItems = items.filter(i => filteredIds.has(i.sale_id))

  useEffect(() => {
    chartsRef.current.forEach(c => c.destroy())
    chartsRef.current = []
    if (!hourlyRef.current || !productRef.current) return

    const byDay = {}
    filteredSales.forEach(s => {
      const d = new Date(s.sold_at).toLocaleDateString()
      byDay[d] = (byDay[d] || 0) + Number(s.total)
    })
    const dayLabels = Object.keys(byDay).sort((a, b) => new Date(a) - new Date(b))
    chartsRef.current.push(new Chart(hourlyRef.current, {
      type: 'line',
      data: { labels: dayLabels, datasets: [{ label: 'Sales ($)', data: dayLabels.map(d => byDay[d]), borderColor: '#2F6E4F', backgroundColor: 'rgba(47,110,79,0.12)', fill: true, tension: 0.3 }] },
      options: { plugins: { legend: { display: false } } }
    }))

    const byProduct = {}
    filteredItems.forEach(i => { byProduct[i.product_name] = (byProduct[i.product_name] || 0) + i.qty * Number(i.unit_price) })
    chartsRef.current.push(new Chart(productRef.current, {
      type: 'doughnut',
      data: { labels: Object.keys(byProduct), datasets: [{ data: Object.values(byProduct), backgroundColor: ['#2F6E4F', '#D9A441', '#C1443C', '#7A4B78', '#3A5F4D', '#E8B4A2'] }] },
      options: { plugins: { legend: { position: 'bottom' } } }
    }))
  }, [filteredSales, filteredItems])

  const gross = filteredSales.reduce((s, x) => s + Number(x.total), 0)
  const gst = filteredSales.reduce((s, x) => s + Number(x.gst_amount), 0)

  return (
    <section>
      <p className="eyebrow">Reporting</p>
      <div className="analytics-toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>How trading is going</h2>
        <div className="toolbar-actions">
          <select value={range} onChange={e => setRange(e.target.value)}>
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </select>
          <button className="link-danger" onClick={clearSales}>Clear sales data</button>
        </div>
      </div>
      <div className="kpi-row">
        <div className="kpi"><div className="label">Orders</div><div className="value">{filteredSales.length}</div></div>
        <div className="kpi"><div className="label">Gross sales</div><div className="value gold">{money(gross)}</div></div>
        <div className="kpi"><div className="label">GST collected</div><div className="value stamp">{money(gst)}</div></div>
      </div>
      <div className="chart-row">
        <div className="chart-card"><h4>Sales by day</h4><canvas ref={hourlyRef}></canvas></div>
        <div className="chart-card"><h4>Revenue by product</h4><canvas ref={productRef}></canvas></div>
      </div>
      {filteredSales.length === 0 && <p>No sales in this range yet.</p>}
      {filteredSales.length > 0 && (
        <table className="stock-table" style={{ marginTop: 16 }}>
          <thead><tr><th>Date</th><th>Time</th><th>Total</th><th>GST</th></tr></thead>
          <tbody>
            {filteredSales.map(s => (
              <tr key={s.id}>
                <td>{new Date(s.sold_at).toLocaleDateString()}</td>
                <td>{new Date(s.sold_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{money(s.total)}</td>
                <td>{money(s.gst_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/* ---------------- CUSTOMERS ---------------- */
function CustomersView({ bizId }) {
  const [customers, setCustomers] = useState([])
  const [form, setForm] = useState({ name: '', suburb: '', age_range: '18-24', notes: '' })

  useEffect(() => { load() }, [bizId])
  async function load() {
    const { data } = await supabase.from('customers').select('*').eq('business_id', bizId).order('created_at', { ascending: false })
    setCustomers(data || [])
  }

  async function addCustomer(e) {
    e.preventDefault()
    if (!form.name) return
    await supabase.from('customers').insert({ business_id: bizId, ...form })
    setForm({ name: '', suburb: '', age_range: '18-24', notes: '' })
    load()
  }

  async function removeCustomer(id) {
    if (!confirm('Delete this customer profile?')) return
    await supabase.from('customers').delete().eq('id', id)
    load()
  }

  async function clearCustomers() {
    if (!confirm('Delete ALL customer profiles for this business? This cannot be undone.')) return
    await supabase.from('customers').delete().eq('business_id', bizId)
    load()
  }

  return (
    <section>
      <p className="eyebrow">Customer data</p>
      <div className="analytics-toolbar">
        <h2 className="section-title" style={{ margin: 0 }}>Collect data, build segmentation profiles</h2>
        {customers.length > 0 && <button className="link-danger" onClick={clearCustomers}>Clear all customers</button>}
      </div>
      <div className="cust-layout">
        <form className="cust-form" onSubmit={addCustomer}>
          <div className="cust-form-title">Log a customer</div>
          <label>Name / nickname</label>
          <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <label>Suburb</label>
          <input value={form.suburb} onChange={e => setForm({ ...form, suburb: e.target.value })} />
          <label>Age range</label>
          <select value={form.age_range} onChange={e => setForm({ ...form, age_range: e.target.value })}>
            <option>Under 12</option><option>13-17</option><option>18-24</option><option>25-40</option><option>40+</option>
          </select>
          <label>Why they bought / what they said</label>
          <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          <button type="submit" className="btn-complete">Save &amp; build profile</button>
        </form>

        <div className="cust-list">
          {customers.map(c => (
            <div className="profile-card" key={c.id}>
              <div className="profile-head">
                <div className="pname">{c.name}</div>
                <div className="phead-right">
                  <span className="ptag">{new Date(c.created_at).toLocaleDateString()}</span>
                  <button className="link-danger" onClick={() => removeCustomer(c.id)}>Delete</button>
                </div>
              </div>
              <div className="seg-grid">
                <div className="seg geo"><div className="seg-label">Geographic</div><div className="seg-body">{c.suburb || 'Not recorded'}</div></div>
                <div className="seg psy"><div className="seg-label">Psychographic</div><div className="seg-body">{c.notes || 'No notes yet'}</div></div>
                <div className="seg beh"><div className="seg-label">Behavioural</div><div className="seg-body">Logged {new Date(c.created_at).toLocaleDateString()}</div></div>
                <div className="seg dem"><div className="seg-label">Demographic</div><div className="seg-body">{c.age_range}</div></div>
              </div>
            </div>
          ))}
          {customers.length === 0 && <p>No customers logged yet.</p>}
        </div>
      </div>
    </section>
  )
}

