import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { TextInput, Button, Text, Surface, HelperText } from 'react-native-paper';
import { useAuth } from '../context/AuthContext';

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
    const result = await login(email, password);
    setLoading(false);
    if (result.success) {
      const { user } = result; // Necesitamos el rol que viene en el resultado del login
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
      <Surface style={styles.surface}>
        <Text style={styles.title}>Seguridad UTA</Text>
        <Text style={styles.subtitle}>Ingrese a su cuenta</Text>
        
        <TextInput
          label="Correo Electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={styles.input}
        />
        
        <TextInput
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
          style={styles.input}
        />

        {error ? <HelperText type="error" visible={true}>{error}</HelperText> : null}

        <Button 
          mode="contained" 
          onPress={handleLogin} 
          loading={loading === true}
          style={styles.button}
        >
          Iniciar Sesión
        </Button>

        <Button 
          onPress={() => alert('Su cuenta es proporcionada por la DITIC.')}
          style={styles.link}
        >
          ¿No puedes entrar? Contacta a la DITIC
        </Button>
      </Surface>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  surface: {
    padding: 24,
    borderRadius: 15,
    backgroundColor: 'white',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#D32F2F',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#666',
  },
  input: {
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  button: {
    marginTop: 10,
    borderRadius: 8,
    backgroundColor: '#D32F2F',
  },
  link: {
    marginTop: 10,
  },
});

export default LoginScreen;
