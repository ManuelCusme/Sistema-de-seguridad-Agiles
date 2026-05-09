import React, { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { Text, Surface, Title, Headline, IconButton } from 'react-native-paper';
import * as Location from 'expo-location';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { Picker } from '@react-native-picker/picker';

const HomeScreen = () => {
  const navigation = useNavigation();
  const { user, token, logout, API_URL } = useAuth();

  const handleLogout = () => {
    logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  const [motivo, setMotivo] = useState('Robo');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Animación del botón
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  const handlePressIn = () => {
    // Iniciar animación de escala y progreso (3 segundos)
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 1, duration: 3000, useNativeDriver: false })
    ]).start();

    timerRef.current = setTimeout(sendAlert, 3000);
  };

  const handlePressOut = () => {
    // Cancelar si suelta antes de los 3 seg
    clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(progressAnim, { toValue: 0, duration: 200, useNativeDriver: false })
    ]).start();
  };

  const sendAlert = async () => {
    setLoading(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      let location = await Location.getCurrentPositionAsync({});
      
      await axios.post(`${API_URL}/incident/panic`, {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        motivo: motivo
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      handlePressOut(); // Reset button
    }
  };

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <View>
          <Headline style={styles.userName}>{user?.Nombre1} {user?.Apellido1}</Headline>
          <Text style={styles.userSub}>{user?.Facultad || 'FISEI'} - {user?.Rol}</Text>
        </View>
        <IconButton icon="logout" iconColor="white" onPress={handleLogout} />
      </Surface>

      <View style={styles.content}>
        <Title style={styles.label}>¿Cuál es la emergencia?</Title>
        <Surface style={styles.pickerContainer}>
          <Picker
            selectedValue={motivo}
            onValueChange={(itemValue) => setMotivo(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="🚨 ROBO" value="Robo" />
            <Picker.Item label="🔪 ARMA BLANCA" value="Arma Blanca" />
            <Picker.Item label="🩹 ACCIDENTE" value="Accidente" />
            <Picker.Item label="⚠️ A COSO" value="Acoso" />
            <Picker.Item label="🔥 INCENDIO" value="Incendio" />
          </Picker>
        </Surface>

        <View style={styles.buttonWrapper}>
          <Animated.View style={[styles.progressCircle, {
            height: progressAnim.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%']
            }),
            opacity: progressAnim.interpolate({
              inputRange: [0, 0.1, 1],
              outputRange: [0, 1, 1]
            })
          }]} />
          
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <TouchableOpacity
              activeOpacity={1}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              style={[styles.panicButton, success && styles.successButton]}
            >
              <Text style={styles.buttonText}>
                {loading ? 'ENVIANDO...' : success ? '¡ALERTA ENVIADA!' : 'PRESIONAR\n3 SEG'}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.hint}>Mantén presionado en caso de peligro real</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 25,
    backgroundColor: '#D32F2F',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 8,
  },
  userName: { color: 'white', fontWeight: 'bold', fontSize: 24 },
  userSub: { color: 'rgba(255,255,255,0.8)', fontSize: 16 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  label: { marginBottom: 10, color: '#333' },
  pickerContainer: {
    width: '100%',
    borderRadius: 15,
    backgroundColor: 'white',
    marginBottom: 40,
    elevation: 2,
    overflow: 'hidden'
  },
  picker: { height: 60, width: '100%' },
  buttonWrapper: {
    width: 250,
    height: 250,
    borderRadius: 125,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eee',
    overflow: 'hidden',
    position: 'relative',
    elevation: 10,
  },
  progressCircle: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    backgroundColor: 'rgba(211, 47, 47, 0.3)',
  },
  panicButton: {
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: '#D32F2F',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 8,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  successButton: { backgroundColor: '#4CAF50' },
  buttonText: {
    color: 'white',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 30,
  },
  hint: { marginTop: 30, color: '#666', fontStyle: 'italic' }
});

export default HomeScreen;