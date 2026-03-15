function n(t){const r=Number(t);return Number.isNaN(r)?"€ —":new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR",minimumFractionDigits:2,maximumFractionDigits:2}).format(r)}export{n as f};
