const QRCode = require('qrcode');
const { requireClubSession } = require('../../_lib/clubAuth');
const { getTierForSpent } = require('../../_lib/clubTiers');

// Cartão digital do membro: dados reais da conta + QR code gerado no
// servidor (biblioteca `qrcode`, sem depender de serviço externo nem de
// um encoder próprio) codificando o número de membro.
module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'Método não permitido.' });
    return;
  }
  const customer = await requireClubSession(req, res);
  if (!customer) return;

  if (!customer.club_member) {
    res.status(200).json({ ok: true, card: null, membershipType: 'iniciante' });
    return;
  }

  const { current } = await getTierForSpent(Number(customer.total_spent) || 0);
  const memberSince = customer.club_joined_at ? new Date(customer.club_joined_at).getFullYear() : null;

  let qrDataUrl = null;
  if (customer.member_number) {
    try {
      qrDataUrl = await QRCode.toDataURL(customer.member_number, { errorCorrectionLevel: 'M', margin: 1, width: 240, color: { dark: '#0c0c0d', light: '#00000000' } });
    } catch (e) {
      qrDataUrl = null;
    }
  }

  res.status(200).json({
    ok: true,
    card: {
      name: customer.name,
      memberNumber: customer.member_number,
      tierName: current ? current.name : null,
      memberSince,
      qrDataUrl,
    },
  });
};
