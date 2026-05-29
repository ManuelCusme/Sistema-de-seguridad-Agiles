import React, { useState } from 'react';
import { ScrollView, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

const inputTheme = {
  colors: {
    onSurfaceVariant: '#334155',
    primary: '#D32F2F',
  },
};

const sharedInputProps = {
  textColor: '#0f172a',
  placeholderTextColor: '#475569',
  underlineColor: '#cbd5e1',
  activeUnderlineColor: '#D32F2F',
  theme: inputTheme,
};

const RegisterScreen = ({ navigation }) => {
  const [form, setForm] = useState({
    nombre1: '',
    nombre2: '',
    apellido1: '',
    apellido2: '',
    email: '',
    password: '',
    birthDate: '2000-01-01',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();

  const handleRegister = async () => {
    setLoading(true);
    setError('');
    try {
        const result = await register({
            ...form,
            birthDate: new Date(form.birthDate).toISOString()
        });
        if (result.success) {
          navigation.navigate('Login');
        } else {
          setError(typeof result.message === 'string' ? result.message : 'Error en el registro');
        }
    } catch (e) {
        setError('Error de conexión');
    } finally {
        setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <Surface style={styles.surface}>
          <Text style={styles.sectionTitle}>Información Personal</Text>
          <TextInput
            label="Primer Nombre"
            value={form.nombre1}
            onChangeText={(v) => setForm({...form, nombre1: v})}
            style={styles.input}
            {...sharedInputProps}
          />
          <TextInput
            label="Segundo Nombre"
            value={form.nombre2}
            onChangeText={(v) => setForm({...form, nombre2: v})}
            style={styles.input}
            {...sharedInputProps}
          />
          <TextInput
            label="Primer Apellido"
            value={form.apellido1}
            onChangeText={(v) => setForm({...form, apellido1: v})}
            style={styles.input}
            {...sharedInputProps}
          />
          <TextInput
            label="Segundo Apellido"
            value={form.apellido2}
            onChangeText={(v) => setForm({...form, apellido2: v})}
            style={styles.input}
            {...sharedInputProps}
          />

          <Text style={styles.sectionTitle}>Cuenta</Text>
          <TextInput
            label="Correo Electrónico"
            value={form.email}
            onChangeText={(v) => setForm({...form, email: v})}
            keyboardType="email-address"
            autoCapitalize="none"
            style={styles.input}
            {...sharedInputProps}
          />
          <TextInput
            label="Contraseña"
            value={form.password}
            onChangeText={(v) => setForm({...form, password: v})}
            secureTextEntry={true}
            style={styles.input}
            {...sharedInputProps}
          />
          <TextInput
            label="Nacimiento (YYYY-MM-DD)"
            value={form.birthDate}
            onChangeText={(v) => setForm({...form, birthDate: v})}
            style={styles.input}
            {...sharedInputProps}
          />

          {error ? <HelperText type="error" visible={true}>{error}</HelperText> : null}

          <Button 
            mode="contained" 
            onPress={handleRegister} 
            loading={loading === true}
            style={styles.button}
          >
            Registrarse
          </Button>
        </Surface>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scroll: {
    padding: 20,
  },
  surface: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 10,
    color: '#333',
  },
  input: {
    marginBottom: 10,
    backgroundColor: 'transparent',
  },
  button: {
    marginTop: 20,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
  },
});

export default RegisterScreen;
