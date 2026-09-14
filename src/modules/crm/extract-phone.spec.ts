import { extractPhone } from './extract-phone';

describe('extractPhone', () => {
  it('saca el número del campo PHONE', () => {
    expect(
      extractPhone({
        custom_fields_values: [
          { field_id: 1, field_name: 'Email', values: [{ value: 'a@b.com' }] },
          {
            field_id: 2,
            field_code: 'PHONE',
            field_name: 'Phone',
            values: [{ value: '+593983335555' }],
          },
        ],
      }),
    ).toBe('+593983335555');
  });

  it('devuelve null si no hay teléfono', () => {
    expect(extractPhone({ custom_fields_values: [] })).toBeNull();
    expect(extractPhone(null)).toBeNull();
  });
});
