export const PAKISTANI_PLATFORMS = [
  // Mobile Wallets / Digital Accounts
  { id: 'easypaisa', name: 'EasyPaisa', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'easypaisa_number' },
  { id: 'jazzcash', name: 'JazzCash', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'jazzcash_number' },
  { id: 'nayapay', name: 'NayaPay', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'nayapay_number' },
  { id: 'sadapay', name: 'SadaPay', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'sadapay_number' },
  { id: 'konnect', name: 'Konnect by HBL', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'easypaisa_number' },
  { id: 'upaisa', name: 'UPaisa', type: 'wallet', placeholder: '03XXXXXXXXX', dbField: 'jazzcash_number' },
  
  // Commercial Banks
  { id: 'meezan', name: 'Meezan Bank', type: 'bank' },
  { id: 'hbl', name: 'Habib Bank Limited (HBL)', type: 'bank' },
  { id: 'ubl', name: 'United Bank Limited (UBL)', type: 'bank' },
  { id: 'alfalah', name: 'Bank Alfalah', type: 'bank' },
  { id: 'abl', name: 'Allied Bank Limited (ABL)', type: 'bank' },
  { id: 'mcb', name: 'MCB Bank', type: 'bank' },
  { id: 'scb', name: 'Standard Chartered Bank', type: 'bank' },
  { id: 'faysal', name: 'Faysal Bank', type: 'bank' },
  { id: 'askari', name: 'Askari Bank', type: 'bank' },
  { id: 'alhabib', name: 'Bank Al Habib', type: 'bank' },
  { id: 'habibmetro', name: 'Habib Metropolitan Bank', type: 'bank' },
  { id: 'js', name: 'JS Bank', type: 'bank' },
  { id: 'dib', name: 'Dubai Islamic Bank', type: 'bank' },
  { id: 'bop', name: 'The Bank of Punjab (BOP)', type: 'bank' },
  { id: 'soneri', name: 'Soneri Bank', type: 'bank' },
  { id: 'silk', name: 'Silk Bank', type: 'bank' },
  { id: 'samba', name: 'Samba Bank', type: 'bank' },
  { id: 'albaraka', name: 'Al Baraka Bank', type: 'bank' },
  { id: 'mcbislamic', name: 'MCB Islamic Bank', type: 'bank' },
  { id: 'bankislami', name: 'BankIslami Pakistan', type: 'bank' },
  { id: 'nbp', name: 'National Bank of Pakistan (NBP)', type: 'bank' },
  { id: 'makramah', name: 'Bank Makramah (Summit Bank)', type: 'bank' }
];

export const getPlatformIcon = (platformId) => {
  switch (platformId) {
    case 'easypaisa': return '🟢';
    case 'jazzcash': return '🔴';
    case 'nayapay': return '🍊';
    case 'sadapay': return '🟢';
    case 'konnect': return '🔵';
    case 'upaisa': return '🟡';
    default: return '🏦';
  }
};
