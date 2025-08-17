function AdminTest() {
  return (
    <div style={{ padding: '20px', backgroundColor: 'white', minHeight: '100vh' }}>
      <h1 style={{ color: 'green', fontSize: '32px' }}>✅ ADMIN ROUTE WORKING!</h1>
      <p style={{ fontSize: '18px', color: 'blue' }}>
        Current time: {new Date().toLocaleTimeString()}
      </p>
      <p style={{ fontSize: '16px' }}>
        If you can see this, the route is working fine.
      </p>
      <button 
        onClick={() => alert('Button clicked!')}
        style={{ padding: '10px 20px', backgroundColor: 'blue', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
      >
        Test Button
      </button>
    </div>
  );
}

export default AdminTest;