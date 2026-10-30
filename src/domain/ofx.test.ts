import { describe, expect, it } from 'vitest';
import { decodificarOfx, lerOfx } from './ofx';

const sgml = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
ENCODING:USASCII
CHARSET:1252

<OFX>
<CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261012000000[-3:BRT]
<TRNAMT>-123.45
<MEMO>Padaria   São João
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20261015
<TRNAMT>-80,00
<NAME>Posto Ipiranga
<MEMO>
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20261005
<TRNAMT>950.00
<MEMO>Pagamento recebido
</STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`;

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261102</DTPOSTED><TRNAMT>59.90</TRNAMT><MEMO>Livraria Cultura</MEMO></STMTTRN>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20261103</DTPOSTED><TRNAMT>12.00</TRNAMT><MEMO>Café</MEMO></STMTTRN>
</BANKTRANLIST></CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1></OFX>`;

const em1252 = (texto: string) => Uint8Array.from(texto, (c) => c.charCodeAt(0));

describe('decodificarOfx', () => {
  it('lê os acentos do OFX 1.x em Windows-1252', () => {
    expect(decodificarOfx(em1252(sgml))).toContain('Padaria   São João');
  });

  it('lê o OFX 2.x em UTF-8', () => {
    expect(decodificarOfx(new TextEncoder().encode(xml))).toContain('Café');
  });
});

describe('lerOfx', () => {
  it('lê o SGML sem tags de fechamento e deixa as compras positivas', () => {
    expect(lerOfx(sgml)).toEqual([
      { data: '2026-10-12', descricao: 'Padaria São João', valor: 12_345 },
      { data: '2026-10-15', descricao: 'Posto Ipiranga', valor: 8_000 },
      { data: '2026-10-05', descricao: 'Pagamento recebido', valor: -95_000 },
    ]);
  });

  it('mantém o sinal quando o banco já manda as compras positivas', () => {
    expect(lerOfx(xml)).toEqual([
      { data: '2026-11-02', descricao: 'Livraria Cultura', valor: 5_990 },
      { data: '2026-11-03', descricao: 'Café', valor: 1_200 },
    ]);
  });

  it('recusa arquivo sem lançamentos', () => {
    expect(() => lerOfx('<OFX></OFX>')).toThrow('Esse arquivo OFX não tem lançamentos.');
  });
});
