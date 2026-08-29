import { render, screen, fireEvent } from '@testing-library/react';
import App from './App';

jest.mock('axios', () => ({
  post: jest.fn()
}));

test('renders the sign-in screen when logged out', () => {
  render(<App />);
  expect(screen.getByText(/welcome back/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
});

test('flips to the register form', () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: /create an account/i }));
  expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
});
