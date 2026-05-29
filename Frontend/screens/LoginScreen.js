import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const inputTheme = {
  colors: {
    onSurfaceVariant: '#334155',
    primary: '#4d82ff',
  },
};

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Por favor complete todos los campos');
      return;
    }

    setLoading(true);
    setError('');

    const result = await login(email.trim(), password);
    setLoading(false);

    if (result.success) {
      const { user } = result;
      if (user?.rol === 'Guardia') {
        navigation.replace('Guard');
      } else {
        navigation.replace('Home');
      }
    } else {
      setError(typeof result.message === 'string' ? result.message : 'Error al iniciar sesión');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.topBand} />
      <Surface style={styles.card}>
        <View style={styles.headerBlock}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Text style={styles.brandMarkText}>UTA</Text>
            </View>
            <View>
              <Text style={styles.brandName}>Seguridad UTA</Text>
              <Text style={styles.brandSubtitle}>Acceso institucional</Text>
            </View>
          </View>
        </View>

        <Surface style={styles.officeCard}>
          <View style={styles.officeRow}>
            <View style={styles.microsoftMark}>
              <View style={[styles.msSquare, { backgroundColor: '#f25022' }]} />
              <View style={[styles.msSquare, { backgroundColor: '#7fba00' }]} />
              <View style={[styles.msSquare, { backgroundColor: '#00a4ef' }]} />
              <View style={[styles.msSquare, { backgroundColor: '#ffb900' }]} />
            </View>
            <View style={styles.officeTextBlock}>
              <Text style={styles.officeLabel}>Microsoft Office 365</Text>
              <Text style={styles.officeHint}>Acceso con credenciales institucionales</Text>
            </View>
          </View>
        </Surface>

        <Text style={styles.divider}>o</Text>

        <View style={styles.form}>
          <Text style={styles.fieldLabel}>Usuario</Text>
          <TextInput
            placeholder="usuario@uta.edu.ec"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            mode="outlined"
            style={styles.input}
            textColor="#0f172a"
            placeholderTextColor="#475569"
            outlineColor="#cbd5e1"
            activeOutlineColor="#4d82ff"
            theme={inputTheme}
          />

          <Text style={styles.fieldLabel}>Contraseña</Text>
          <TextInput
            placeholder="••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            mode="outlined"
            style={styles.input}
            textColor="#0f172a"
            placeholderTextColor="#475569"
            outlineColor="#cbd5e1"
            activeOutlineColor="#4d82ff"
            theme={inputTheme}
          />

          <View style={styles.actions}>
            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.loginButton}
              contentStyle={styles.loginButtonContent}
            >
              Iniciar sesión
            </Button>

            <Button
              mode="outlined"
              onPress={() => {
                setEmail('');
                setPassword('');
                setError('');
              }}
              style={styles.clearButton}
              disabled={loading}
              contentStyle={styles.clearButtonContent}
            >
              Limpiar
            </Button>
          </View>

          <Button
            onPress={() => alert('Su cuenta es proporcionada por la DITIC.')}
            style={styles.helpButton}
          >
            ¿No puedes entrar? Contacta a la DITIC
          </Button>
        </View>

        {error ? <HelperText type="error" visible>{error}</HelperText> : null}
      </Surface>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#f3f6fb',
    padding: 16,
  },
  topBand: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 190,
    backgroundColor: '#0b3354',
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.12)',
    elevation: 8,
    shadowOpacity: 0.14,
    shadowRadius: 16,
  },
  headerBlock: {
    marginBottom: 12,
  },
  officeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
    width: '100%',
    paddingHorizontal: 6,
  },
  microsoftMark: {
    width: 22,
    height: 22,
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 2,
  },
  msSquare: {
    width: 8,
    height: 8,
    margin: 0.5,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  brandMark: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#4d82ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 4,
  },
  brandMarkText: {
    color: 'white',
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  brandName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0b3354',
  },
  brandSubtitle: {
    fontSize: 13,
    color: '#64748b',
  },
  kicker: {
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#6b7280',
    fontWeight: '700',
    marginTop: 2,
    marginBottom: 4,
  },
  pageTitle: {
    color: '#111827',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 6,
  },
  pageText: {
    color: '#475569',
    lineHeight: 20,
    fontSize: 14,
    marginBottom: 4,
  },
  officeCard: {
    marginTop: 16,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(77,130,255,0.20)',
    backgroundColor: '#fbfdff',
    elevation: 1,
  },
  officeLabel: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '700',
  },
  officeTextBlock: {
    flex: 1,
  },
  officeHint: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    textAlign: 'center',
    color: '#94a3b8',
    marginVertical: 10,
    fontSize: 15,
  },
  form: {
    gap: 8,
  },
  fieldLabel: {
    color: '#334155',
    fontSize: 14,
    marginTop: 2,
  },
  input: {
    backgroundColor: '#fff',
  },
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
  },
  loginButton: {
    flex: 1,
    borderRadius: 14,
    backgroundColor: '#4d82ff',
  },
  loginButtonContent: {
    height: 50,
  },
  clearButton: {
    borderRadius: 14,
    borderColor: '#d1d5db',
    flex: 0.9,
  },
  clearButtonContent: {
    height: 50,
    paddingHorizontal: 6,
  },
  helpButton: {
    marginTop: 6,
  },
});

export default LoginScreen;
