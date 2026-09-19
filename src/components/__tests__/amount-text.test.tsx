import { render, screen } from '@testing-library/react-native';

import { AmountText } from '@/components/amount-text';

describe('<AmountText />', () => {
  it('renders formatted paise and exposes it to screen readers', async () => {
    await render(<AmountText amountPaise={12345678} />);

    expect(screen.getByLabelText(/1,23,456\.78/)).toBeOnTheScreen();
  });

  it('renders negative amounts with a sign', async () => {
    await render(<AmountText amountPaise={-5000} colorBySign />);

    expect(screen.getByText(/-/)).toBeOnTheScreen();
  });

  it('formats without decimals when asked', async () => {
    await render(<AmountText amountPaise={150000} formatOptions={{ withDecimals: false }} />);

    expect(screen.getByText(/1,500/)).toBeOnTheScreen();
  });
});
