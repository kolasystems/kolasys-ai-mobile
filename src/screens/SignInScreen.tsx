import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useSignIn, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../lib/theme';

WebBrowser.maybeCompleteAuthSession();

type MfaStrategy = 'email_code' | 'totp';

/** Extract a human-readable message from any Clerk or JS error. */
function getClerkErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object') {
    const clerkErr = err as { errors?: Array<{ longMessage?: string; message?: string }> };
    if (Array.isArray(clerkErr.errors) && clerkErr.errors.length > 0) {
      const first = clerkErr.errors[0];
      return first.longMessage ?? first.message ?? fallback;
    }
    if (err instanceof Error && err.message) return err.message;
  }
  return fallback;
}

/** Pick the best available second-factor strategy, preferring email_code. */
function pickMfaStrategy(
  factors: Array<{ strategy: string }> | null | undefined,
): MfaStrategy | null {
  if (!factors || factors.length === 0) return null;
  const strategies = factors.map((f) => f.strategy);
  if (strategies.includes('email_code')) return 'email_code';
  if (strategies.includes('totp')) return 'totp';
  return null;
}

// ─── MFA view ────────────────────────────────────────────────────────────────

interface MfaViewProps {
  strategy: MfaStrategy;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
}

function MfaView({ strategy, onVerify, onResend, onBack }: MfaViewProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const isEmail = strategy === 'email_code';
  const canVerify = code.trim().length > 0 && !verifying;

  const handleVerify = async () => {
    if (!canVerify) return;
    setVerifying(true);
    try {
      await onVerify(code.trim());
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await onResend();
      Alert.alert('Code sent', 'A new verification code has been sent to your email.');
      setCode('');
      inputRef.current?.focus();
    } catch (err) {
      Alert.alert('Error', getClerkErrorMessage(err, 'Failed to resend code.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={20} color={Colors.primary} />
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.brand}>
          <View style={styles.logoContainer}>
            <Ionicons name={isEmail ? 'mail' : 'shield-checkmark'} size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Verification Required</Text>
          <Text style={styles.tagline}>
            {isEmail
              ? 'Enter the 6-digit code sent to your email.'
              : 'Enter the code from your authenticator app.'}
          </Text>
        </View>

        <View style={[styles.inputWrapper, styles.codeInputWrapper]}>
          <Ionicons name="key-outline" size={18} color="#6b7280" />
          <TextInput
            ref={inputRef}
            style={[styles.input, styles.codeInput]}
            placeholder="123456"
            placeholderTextColor="#6b7280"
            value={code}
            onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete={isEmail ? 'one-time-code' : 'off'}
            autoFocus
            maxLength={6}
            onSubmitEditing={handleVerify}
          />
        </View>

        <TouchableOpacity
          style={[styles.signInButton, { opacity: canVerify ? 1 : 0.6 }]}
          onPress={handleVerify}
          disabled={!canVerify}
          activeOpacity={0.8}
        >
          {verifying ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Text style={styles.signInButtonText}>Verify</Text>
          )}
        </TouchableOpacity>

        {isEmail && (
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
            activeOpacity={0.7}
          >
            {resending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Text style={styles.resendText}>Resend code</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { startSSOFlow } = useSSO();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mfaStrategy, setMfaStrategy] = useState<MfaStrategy | null>(null);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const redirectUrl = AuthSession.makeRedirectUri();
      const { createdSessionId, setActive: setActiveSSO } = await startSSOFlow({
        strategy: 'oauth_google',
        redirectUrl,
      });
      if (createdSessionId) {
        await setActiveSSO!({ session: createdSessionId });
      }
    } catch (err: unknown) {
      Alert.alert('Sign In Error', getClerkErrorMessage(err, 'Google sign-in failed.'));
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!isLoaded || !signIn) {
      Alert.alert('Please wait', 'Authentication is still loading. Try again in a moment.');
      return;
    }
    if (!email.trim() || !password) return;

    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email.trim(), password });

      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
      } else if (result.status === 'needs_second_factor') {
        const strategy = pickMfaStrategy(result.supportedSecondFactors);
        if (!strategy) {
          Alert.alert('Sign In Error', 'Unsupported second-factor method. Contact support.');
          return;
        }
        if (strategy === 'email_code') {
          await signIn.prepareSecondFactor({ strategy: 'email_code' });
        }
        setMfaStrategy(strategy);
      } else {
        Alert.alert('Sign In Error', `Unexpected sign-in status: ${result.status}. Contact support.`);
      }
    } catch (err: unknown) {
      Alert.alert('Sign In Error', getClerkErrorMessage(err, 'Sign in failed. Check your email and password.'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (code: string) => {
    if (!signIn || !mfaStrategy) return;
    try {
      const result = await signIn.attemptSecondFactor({ strategy: mfaStrategy, code });
      if (result.status === 'complete') {
        await setActive!({ session: result.createdSessionId });
      } else {
        Alert.alert('Verification Error', `Unexpected status: ${result.status}. Contact support.`);
      }
    } catch (err: unknown) {
      const message = getClerkErrorMessage(
        err,
        mfaStrategy === 'email_code'
          ? 'Incorrect code. Check your email and try again.'
          : 'Incorrect code. Check your authenticator app and try again.',
      );
      Alert.alert('Verification Failed', message);
      throw err;
    }
  };

  const handleResend = async () => {
    if (!signIn) return;
    await signIn.prepareSecondFactor({ strategy: 'email_code' });
  };

  if (mfaStrategy) {
    return (
      <MfaView
        strategy={mfaStrategy}
        onVerify={handleVerify}
        onResend={handleResend}
        onBack={() => setMfaStrategy(null)}
      />
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo + Brand */}
        <View style={styles.brand}>
          <View style={styles.logoContainer}>
            <Ionicons name="mic" size={40} color={Colors.primary} />
          </View>
          <Text style={styles.appName}>Kolasys AI</Text>
          <Text style={styles.tagline}>AI-powered meeting notes</Text>
        </View>

        {/* Google Sign In */}
        <TouchableOpacity
          style={styles.googleButton}
          onPress={handleGoogleSignIn}
          disabled={googleLoading}
          activeOpacity={0.8}
        >
          {googleLoading ? (
            <ActivityIndicator size="small" color="#111827" />
          ) : (
            <>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email + Password */}
        <View style={styles.form}>
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={18} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="Email address"
              placeholderTextColor="#6b7280"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </View>

          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={18} color="#6b7280" />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#6b7280"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#6b7280"
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.signInButton, { opacity: loading || !isLoaded || !email.trim() || !password ? 0.6 : 1 }]}
            onPress={handleEmailSignIn}
            disabled={loading || !isLoaded || !email.trim() || !password}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.signInButtonText}>Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#ffffff' },
  container: {
    flexGrow: 1,
    padding: 28,
    justifyContent: 'center',
    gap: 20,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 2,
    marginBottom: 8,
  },
  backText: { fontSize: 15, fontWeight: '600', color: Colors.primary },
  brand: { alignItems: 'center', marginBottom: 12, gap: 10 },
  logoContainer: {
    width: 84,
    height: 84,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '20',
  },
  appName: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5, color: '#111827' },
  tagline: { fontSize: 15, textAlign: 'center', paddingHorizontal: 16, color: '#6b7280' },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#ffffff',
    gap: 10,
  },
  googleButtonText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#e5e7eb' },
  dividerText: { fontSize: 13, color: '#6b7280' },
  form: { gap: 12 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e5e7eb',
    backgroundColor: '#f9fafb',
    paddingHorizontal: 14,
    gap: 10,
  },
  codeInputWrapper: {},
  input: { flex: 1, fontSize: 15, color: '#111827' },
  codeInput: { fontSize: 22, fontWeight: '600', letterSpacing: 6 },
  signInButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  signInButtonText: { color: Colors.white, fontSize: 16, fontWeight: '700' },
  resendButton: { alignItems: 'center', paddingVertical: 4, marginTop: -4 },
  resendText: { fontSize: 14, fontWeight: '600', color: Colors.primary },
  footer: { fontSize: 11, textAlign: 'center', lineHeight: 16, marginTop: 8, color: '#9ca3af' },
});
