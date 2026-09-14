/* Demo credentials are issued only for newly registered, simulated accounts. */
const byId = id => document.getElementById(id);
let session;
try { session = JSON.parse(sessionStorage.getItem('demo-session') || 'null'); } catch { session = null; }

function show(id, message) {
  byId(id).textContent = message;
  byId(id).hidden = false;
}
function clearMessages(prefix) {
  for (const suffix of ['error', 'success']) {
    byId(`${prefix}-${suffix}`).hidden = true;
    byId(`${prefix}-${suffix}`).textContent = '';
  }
}
function renderSession() {
  byId('send-button').disabled = !session;
  byId('account-details').hidden = !session;
  byId('session-status').textContent = session ? `Sending as ${session.name}` : 'Create an account to start sending.';
  byId('account-id').textContent = session?.userId || '';
}
async function send(path, data, token) {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(data),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || 'The request could not be completed.');
  return { body, token: response.headers.get('x-demo-token') };
}
byId('registration-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearMessages('registration');
  const name = byId('name').value.trim();
  const email = byId('email').value.trim();
  if (!name) return show('registration-error', 'Enter your full name.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return show('registration-error', 'Enter a valid email address.');
  const button = event.currentTarget.querySelector('button');
  button.disabled = true;
  try {
    const { body, token } = await send('/api/users', { name, email, accountType: byId('accountType').value });
    session = { userId: body.id, name: body.name, token };
    sessionStorage.setItem('demo-session', JSON.stringify(session));
    clearMessages('transfer');
    renderSession();
    show('registration-success', 'Account created successfully. You are ready to send.');
  } catch (error) { show('registration-error', error instanceof TypeError ? 'Unable to connect. Please try again.' : error.message); }
  finally { button.disabled = false; }
});
byId('transfer-form').addEventListener('submit', async event => {
  event.preventDefault();
  clearMessages('transfer');
  if (!session) return show('transfer-error', 'Create an account before sending a transfer.');
  const recipientId = byId('recipientId').value.trim();
  const amount = Number(byId('amount').value);
  if (!recipientId) return show('transfer-error', 'Enter a recipient account ID.');
  if (!Number.isFinite(amount) || amount <= 0 || !/^\d+(\.\d{1,2})?$/.test(String(amount))) {
    return show('transfer-error', 'Enter an amount greater than zero with at most two decimal places.');
  }
  byId('send-button').disabled = true;
  try {
    const { body } = await send('/api/transactions', { userId: session.userId, recipientId, amount, type: 'transfer' }, session.token);
    show('transfer-success', `Transfer recorded: $${body.amount.toFixed(2)}. Reference: ${body.id}`);
    byId('amount').value = '';
  } catch (error) { show('transfer-error', error instanceof TypeError ? 'Unable to connect. Please try again.' : error.message); }
  finally { byId('send-button').disabled = false; }
});
renderSession();
