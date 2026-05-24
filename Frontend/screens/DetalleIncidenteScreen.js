import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Title, Surface, Card, Paragraph } from 'react-native-paper';

const DetalleIncidenteScreen = ({ route }) => {
  const incidenteId = route.params?.incidenteId || 'Desconocido';
  const zona = route.params?.zona || 'No disponible';
  const tipo = route.params?.tipo || 'Emergencia';
  const timestamp = route.params?.timestamp || new Date().toLocaleString();

  return (
    <View style={styles.container}>
      <Surface style={styles.header}>
        <Title style={styles.headerTitle}>DETALLE DE INCIDENTE</Title>
      </Surface>
      
      <View style={styles.content}>
        <Card style={styles.card}>
          <Card.Content>
            <Title>ID del Incidente</Title>
            <Paragraph>{incidenteId}</Paragraph>
            
            <View style={styles.spacer} />
            
            <Title>Tipo de Emergencia</Title>
            <Paragraph style={styles.alertText}>{tipo.toUpperCase()}</Paragraph>
            
            <View style={styles.spacer} />
            
            <Title>Zona Detectada</Title>
            <Paragraph>{zona}</Paragraph>
            
            <View style={styles.spacer} />
            
            <Title>Hora de Reporte</Title>
            <Paragraph>{timestamp}</Paragraph>
          </Card.Content>
        </Card>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    paddingTop: 50,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: '#1B5E20',
    alignItems: 'center',
    elevation: 4
  },
  headerTitle: { color: 'white', fontSize: 18 },
  content: { padding: 20 },
  card: { padding: 10, borderLeftWidth: 5, borderLeftColor: '#D32F2F' },
  spacer: { height: 15 },
  alertText: { color: '#D32F2F', fontWeight: 'bold' }
});

export default DetalleIncidenteScreen;
