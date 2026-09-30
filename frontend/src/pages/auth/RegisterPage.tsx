import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Eye,
  EyeOff,
  Car,
  User,
  Mail,
  Phone,
  Lock,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface FormData {
  full_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone: string;
}

interface FieldErrors {
  full_name?: string;
  email?: string;
  password?: string;
  confirm_password?: string;
  phone?: string;
}

interface InputFieldProps {
  label: string;
  name: string;
  type?: string;
  icon: React.ElementType;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  error?: string;
  rightElement?: React.ReactNode;
}

/* IMPORTANT:
   Keep this component OUTSIDE RegisterPage.
   This prevents the input from losing focus after every character.
*/
function InputField({
  label,
  name,
  type = 'text',
  icon: Icon,
  placeholder,
  value,
  onChange,
  error,
  rightElement,
}: InputFieldProps) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label}
      </label>

      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`input-field pl-10 ${
            rightElement ? 'pr-10' : ''
          } ${
            error ? 'border-red-400 focus:ring-red-400' : ''
          }`}
        />

        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">
          {error}
        </p>
      )}
    </div>
  );
}

export default function RegisterPage() {
  const navigate = useNavigate();

  const [form, setForm] = useState<FormData>({
    full_name: '',
    email: '',
    password: '',
    confirm_password: '',
    phone: '',
  });

  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState('');

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const { name, value } = e.target;

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }));

    // Remove the error for the field while typing
    setErrors((previous) => ({
      ...previous,
      [name]: undefined,
    }));

    setApiError('');
  };

  const validate = (): boolean => {
    const newErrors: FieldErrors = {};

    if (!form.full_name.trim()) {
      newErrors.full_name = 'Full name is required';
    }

    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Enter a valid email';
    }

    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password =
        'Password must be at least 6 characters';
    }

    if (!form.confirm_password) {
      newErrors.confirm_password =
        'Please confirm your password';
    } else if (
      form.password !== form.confirm_password
    ) {
      newErrors.confirm_password =
        'Passwords do not match';
    }

    if (
      form.phone &&
      !/^\d{10}$/.test(form.phone)
    ) {
      newErrors.phone =
        'Enter a valid 10-digit phone number';
    }

    setErrors(newErrors);

    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setApiError('');

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      const response = await api.post(
        '/auth/register',
        {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          confirm_password: form.confirm_password,
          phone: form.phone.trim() || undefined,
        }
      );

      console.log('Registration response:', response.data);

      toast.success(
        'Registration successful! Please log in.'
      );

      navigate('/login');
    } catch (err: unknown) {
      console.error('Registration error:', err);

      const error = err as {
        response?: {
          status?: number;
          data?: {
            message?: string;
            error?: string;
          };
        };
        message?: string;
      };

      const message =
        error.response?.data?.message ||
        error.response?.data?.error ||
        error.message ||
        'Registration failed. Please try again.';

      setApiError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-blue-950 via-blue-900 to-slate-900">

      {/* LEFT SIDE */}
      <div className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center p-12">
        <div className="relative z-10 text-center">

          <div className="flex items-center justify-center w-24 h-24 bg-blue-500 rounded-3xl mb-8 mx-auto shadow-2xl">
            <Car className="w-14 h-14 text-white" />
          </div>

          <h1 className="text-4xl font-bold text-white mb-4">
            Join Smart Parking
          </h1>

          <p className="text-blue-200 text-lg max-w-sm leading-relaxed">
            Create your account and start managing parking
            reservations effortlessly.
          </p>

          <div className="mt-12 space-y-4">
            {[
              'Reserve parking slots in seconds',
              'Get real-time slot availability',
              'Track your parking history',
              'Receive instant notifications',
            ].map((feature) => (
              <div
                key={feature}
                className="flex items-center gap-3 text-blue-100"
              >
                <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />

                <span className="text-sm">
                  {feature}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* RIGHT SIDE */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 overflow-y-auto">

        <div className="w-full max-w-md py-8">

          {/* MOBILE HEADER */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">

            <div className="flex items-center justify-center w-12 h-12 bg-blue-500 rounded-xl">
              <Car className="w-7 h-7 text-white" />
            </div>

            <h1 className="text-2xl font-bold text-white">
              Smart Parking
            </h1>

          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8">

            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create Account
            </h2>

            <p className="text-gray-500 mb-6 text-sm">
              Fill in your details to get started
            </p>

            {/* API ERROR */}
            {apiError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-2">

                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />

                <p className="text-sm text-red-600">
                  {apiError}
                </p>

              </div>
            )}

            <form
              onSubmit={handleSubmit}
              className="space-y-4"
            >

              {/* FULL NAME */}
              <InputField
                label="Full Name"
                name="full_name"
                icon={User}
                placeholder="John Doe"
                value={form.full_name}
                onChange={handleChange}
                error={errors.full_name}
              />

              {/* EMAIL */}
              <InputField
                label="Email Address"
                name="email"
                type="email"
                icon={Mail}
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                error={errors.email}
              />

              {/* PHONE */}
              <InputField
                label="Phone Number (optional)"
                name="phone"
                type="tel"
                icon={Phone}
                placeholder="9876543210"
                value={form.phone}
                onChange={handleChange}
                error={errors.phone}
              />

              {/* PASSWORD */}
              <InputField
                label="Password"
                name="password"
                type={
                  showPassword
                    ? 'text'
                    : 'password'
                }
                icon={Lock}
                placeholder="Min. 6 characters"
                value={form.password}
                onChange={handleChange}
                error={errors.password}
                rightElement={
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (previous) => !previous
                      )
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />

              {/* CONFIRM PASSWORD */}
              <InputField
                label="Confirm Password"
                name="confirm_password"
                type={
                  showConfirm
                    ? 'text'
                    : 'password'
                }
                icon={Lock}
                placeholder="Re-enter password"
                value={form.confirm_password}
                onChange={handleChange}
                error={errors.confirm_password}
                rightElement={
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirm(
                        (previous) => !previous
                      )
                    }
                    className="text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />

              {/* ROLE */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">
                    Role:
                  </span>{' '}
                  User — Normal users register as USER.
                  Admin accounts are created separately.
                </p>
              </div>

              {/* SUBMIT */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Creating Account...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>

            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              Already have an account?{' '}

              <Link
                to="/login"
                className="text-blue-600 font-semibold hover:text-blue-800"
              >
                Sign in
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}