import { useState } from 'react';

import { AmountInput } from '@/components/amount-input';
import { fireEvent, renderWithTheme, screen } from '@/test-utils/render';

function Harness({ initial = null }: { initial?: number | null }) {
  const [paise, setPaise] = useState<number | null>(initial);
  return <AmountInput label="Amount" valuePaise={paise} onChangePaise={setPaise} />;
}

describe('<AmountInput />', () => {
  it('parses typed rupees into integer paise', async () => {
    const onChangePaise = jest.fn();
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={null} onChangePaise={onChangePaise} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Amount'), '1234.56');
    expect(onChangePaise).toHaveBeenLastCalledWith(123456);
  });

  it('handles the float trap: 0.1 and 0.2 stay exact', async () => {
    const onChangePaise = jest.fn();
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={null} onChangePaise={onChangePaise} />,
    );

    const input = screen.getByLabelText('Amount');
    await fireEvent.changeText(input, '0.1');
    expect(onChangePaise).toHaveBeenLastCalledWith(10);
    await fireEvent.changeText(input, '0.2');
    expect(onChangePaise).toHaveBeenLastCalledWith(20);
  });

  it('strips grouping commas and the rupee symbol', async () => {
    const onChangePaise = jest.fn();
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={null} onChangePaise={onChangePaise} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Amount'), '₹1,00,000');
    expect(onChangePaise).toHaveBeenLastCalledWith(10000000);
  });

  it('reports null when cleared', async () => {
    const onChangePaise = jest.fn();
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={12345} onChangePaise={onChangePaise} />,
    );

    await fireEvent.changeText(screen.getByLabelText('Amount'), '');
    expect(onChangePaise).toHaveBeenLastCalledWith(null);
  });

  it('shows a validation error for unparseable input', async () => {
    await renderWithTheme(<Harness />);

    await fireEvent.changeText(screen.getByLabelText('Amount'), '12.3.4');
    expect(screen.getByText('Enter a valid amount')).toBeOnTheScreen();
  });

  it('previews the parsed amount with Indian grouping', async () => {
    await renderWithTheme(<Harness />);

    await fireEvent.changeText(screen.getByLabelText('Amount'), '100000');
    expect(screen.getByText('₹1,00,000.00')).toBeOnTheScreen();
  });

  it('seeds the field from an existing paise value', async () => {
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={250000} onChangePaise={() => {}} />,
    );
    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('2,500.00');
  });

  it('uses a decimal keypad', async () => {
    await renderWithTheme(
      <AmountInput label="Amount" valuePaise={null} onChangePaise={() => {}} />,
    );
    expect(screen.getByLabelText('Amount')).toHaveProp('keyboardType', 'decimal-pad');
  });
});
