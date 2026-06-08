import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonApp,
  IonBadge,
  IonButton,
  IonButtons,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardSubtitle,
  IonCardTitle,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonNote,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonRouterOutlet,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonTextarea,
  IonTitle,
  IonToast,
  IonToolbar,
} from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { Redirect, Route, useHistory, useParams } from 'react-router-dom';
import {
  addCircleOutline,
  alertCircleOutline,
  arrowBackOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  cogOutline,
  copyOutline,
  locateOutline,
  logOutOutline,
  mapOutline,
  menuOutline,
  peopleOutline,
  qrCodeOutline,
  refreshOutline,
  shieldCheckmarkOutline,
  timeOutline,
} from 'ionicons/icons';
import * as signalR from '@microsoft/signalr';
import QRCode from 'qrcode';

import { INCIDENT_CATALOG, INCIDENT_DEFAULT, getIncidentByValue, mapIncidentTypesFromApi } from './data/incidentCatalog.js';
import { api, apiUrl, getApiBaseUrl, getErrorMessage, hubUrl, setApiBaseUrl } from './services/api.js';
import { formatDateTime } from './utils/date.js';

const AuthContext = createContext(null);

const initialRegisterForm = {
  nombre1: '',
  nombre2: '',
  apellido1: '',
  apellido2: '',
  email: '',
  password: '',
  birthDate: '2000-01-01',
  facultad: 'FISEI',
};

function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('utaSecurityToken') || '');
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('utaSecurityUser');
    return stored ? JSON.parse(stored) : null;
  });

  const login = async (email, password) => {
    const response = await api.post(apiUrl('/identity/login'), {
      usuEmail: email,
      usuPassword: password,
    });

    const data = response.data;
    const [firstName = '', lastName = ''] = String(data.usuNombreCompleto || '').split(' ');
    const mappedUser = {
      id: data.usuId,
      Nombre1: firstName,
      Apellido1: lastName,
      email: data.usuEmail,
      Rol: data.usuRole,
      rol: data.usuRole,
      Facultad: data.usuFacultad,
    };

    localStorage.setItem('utaSecurityToken', data.usuToken);
    localStorage.setItem('utaSecurityUser', JSON.stringify(mappedUser));
    setToken(data.usuToken);
    setUser(mappedUser);
    return mappedUser;
  };

  const register = async (form) => {
    await api.post(apiUrl('/identity/register'), {
      usuNombre1: form.nombre1,
      usuNombre2: form.nombre2,
      usuApellido1: form.apellido1,
      usuApellido2: form.apellido2,
      usuEmail: form.email,
      usuPassword: form.password,
      usuBirthDate: new Date(form.birthDate).toISOString(),
      usuFacultad: form.facultad || 'FISEI',
    });
  };

  const logout = () => {
    localStorage.removeItem('utaSecurityToken');
    localStorage.removeItem('utaSecurityUser');
    setToken('');
    setUser(null);
  };

  const value = useMemo(() => ({ token, user, login, register, logout }), [token, user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const useAuth = () => useContext(AuthContext);

function Shell({ title, subtitle, children, actions }) {
  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar className="app-toolbar">
          <div className="toolbar-title">
            <IonTitle>{title}</IonTitle>
            {subtitle ? <IonNote>{subtitle}</IonNote> : null}
          </div>
          {actions ? <IonButtons slot="end">{actions}</IonButtons> : null}
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>{children}</IonContent>
    </IonPage>
  );
}

function Toast({ message, color = 'dark', onClose }) {
  return (
    <IonToast
      isOpen={Boolean(message)}
      message={message || ''}
      color={color}
      duration={2800}
      position="top"
      onDidDismiss={onClose}
    />
  );
}

function LoginPage() {
  const history = useHistory();
  const { user, login } = useAuth();
  const [email, setEmail] = useState('estudiante1@uta.edu.ec');
  const [password, setPassword] = useState('123456');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    if (user?.rol === 'Guardia') history.replace('/guard');
    if (user?.rol && user.rol !== 'Guardia') history.replace('/student');
  }, [user, history]);

  const submit = async (event) => {
    event.preventDefault();
    if (!email || !password) {
      setToast('Completa correo y contrasena.');
      return;
    }

    setBusy(true);
    try {
      const loggedUser = await login(email.trim(), password);
      history.replace(loggedUser.rol === 'Guardia' ? '/guard' : '/student');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo iniciar sesion.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell title="Seguridad UTA" subtitle="Acceso institucional">
      <div className="login-band" />
      <main className="login-layout">
        <section className="brand-card">
          <div className="brand-row">
            <div className="brand-mark">UTA</div>
            <div>
              <h1>Seguridad UTA</h1>
              <p>Aplicacion movil de alertas para estudiantes y guardias.</p>
            </div>
          </div>
          <form className="stack" onSubmit={submit}>
            <IonInput label="Correo" labelPlacement="stacked" type="email" value={email} onIonInput={(e) => setEmail(e.detail.value || '')} />
            <IonInput label="Contrasena" labelPlacement="stacked" type="password" value={password} onIonInput={(e) => setPassword(e.detail.value || '')} />
            <IonButton expand="block" type="submit" disabled={busy}>{busy ? <IonSpinner name="crescent" /> : 'Iniciar sesion'}</IonButton>
            <IonButton fill="clear" expand="block" routerLink="/register">Crear cuenta de estudiante</IonButton>
            <IonButton fill="outline" expand="block" routerLink="/settings">Configurar servidor</IonButton>
          </form>
        </section>
      </main>
      <Toast message={toast} color="danger" onClose={() => setToast('')} />
    </Shell>
  );
}

function RegisterPage() {
  const history = useHistory();
  const { register } = useAuth();
  const [form, setForm] = useState(initialRegisterForm);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await register(form);
      setToast('Cuenta registrada. Ya puedes iniciar sesion.');
      setTimeout(() => history.replace('/login'), 700);
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo registrar la cuenta.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell
      title="Registro"
      subtitle="Cuenta de estudiante"
      actions={<IonButton fill="clear" routerLink="/login"><IonIcon icon={arrowBackOutline} /></IonButton>}
    >
      <main className="page-pad">
        <form className="panel stack" onSubmit={submit}>
          <IonInput label="Primer nombre" labelPlacement="stacked" value={form.nombre1} onIonInput={(e) => update('nombre1', e.detail.value || '')} />
          <IonInput label="Segundo nombre" labelPlacement="stacked" value={form.nombre2} onIonInput={(e) => update('nombre2', e.detail.value || '')} />
          <IonInput label="Primer apellido" labelPlacement="stacked" value={form.apellido1} onIonInput={(e) => update('apellido1', e.detail.value || '')} />
          <IonInput label="Segundo apellido" labelPlacement="stacked" value={form.apellido2} onIonInput={(e) => update('apellido2', e.detail.value || '')} />
          <IonInput label="Correo institucional" labelPlacement="stacked" type="email" value={form.email} onIonInput={(e) => update('email', e.detail.value || '')} />
          <IonInput label="Contrasena" labelPlacement="stacked" type="password" value={form.password} onIonInput={(e) => update('password', e.detail.value || '')} />
          <IonInput label="Fecha nacimiento" labelPlacement="stacked" type="date" value={form.birthDate} onIonInput={(e) => update('birthDate', e.detail.value || '')} />
          <IonInput label="Facultad" labelPlacement="stacked" value={form.facultad} onIonInput={(e) => update('facultad', e.detail.value || '')} />
          <IonButton expand="block" type="submit" disabled={busy}>{busy ? <IonSpinner name="crescent" /> : 'Registrarse'}</IonButton>
        </form>
      </main>
      <Toast message={toast} color={toast.startsWith('Cuenta') ? 'success' : 'danger'} onClose={() => setToast('')} />
    </Shell>
  );
}

function SettingsPage() {
  const history = useHistory();
  const [value, setValue] = useState(getApiBaseUrl());
  const [toast, setToast] = useState('');

  const save = () => {
    setApiBaseUrl(value);
    setToast('Servidor guardado.');
  };

  return (
    <Shell
      title="Servidor"
      subtitle="Conexion al gateway C#"
      actions={<IonButton fill="clear" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></IonButton>}
    >
      <main className="page-pad">
        <section className="panel stack">
          <IonIcon className="panel-icon" icon={cogOutline} />
          <h2>URL del backend</h2>
          <p className="muted">En APK usa la IP de la computadora donde corre el gateway, por ejemplo http://192.168.0.5:5000.</p>
          <IonInput label="API base" labelPlacement="stacked" value={value} onIonInput={(e) => setValue(e.detail.value || '')} />
          <IonButton expand="block" onClick={save}>Guardar</IonButton>
          <IonButton fill="outline" expand="block" routerLink="/login">Volver al login</IonButton>
        </section>
      </main>
      <Toast message={toast} color="success" onClose={() => setToast('')} />
    </Shell>
  );
}

function useIncidentTypes(token) {
  const [catalog, setCatalog] = useState(INCIDENT_CATALOG);

  const load = useCallback(async () => {
    try {
      const response = await api.get(apiUrl('/incident-types'), {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setCatalog(mapIncidentTypesFromApi(response.data));
    } catch {
      setCatalog(INCIDENT_CATALOG);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  return { catalog, load };
}

function StudentPage() {
  const history = useHistory();
  const { user, token, logout } = useAuth();
  const { catalog, load: loadCatalog } = useIncidentTypes(token);
  const [active, setActive] = useState('alert');
  const [motivo, setMotivo] = useState(INCIDENT_DEFAULT.value);
  const [busy, setBusy] = useState(false);
  const [historyItems, setHistoryItems] = useState([]);
  const [trustGroups, setTrustGroups] = useState([]);
  const [joinedGroups, setJoinedGroups] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [invite, setInvite] = useState(null);
  const [inviteQr, setInviteQr] = useState('');
  const [inviteTokenInput, setInviteTokenInput] = useState('');
  const [toast, setToast] = useState('');

  const myUserId = user?.id || '';

  const loadHistory = useCallback(async () => {
    if (!token || !myUserId) return;
    const response = await api.get(apiUrl('/incidents'));
    const items = Array.isArray(response.data) ? response.data : [];
    setHistoryItems(items.filter((item) => String(item.incUsuarioId || '').toLowerCase() === String(myUserId).toLowerCase()));
  }, [token, myUserId]);

  const loadTrustGroups = useCallback(async () => {
    if (!myUserId) return;
    const [owned, joined] = await Promise.all([
      api.get(apiUrl('/trust-groups'), { params: { usuId: myUserId } }),
      api.get(apiUrl('/trust-groups/member-of'), { params: { usuId: myUserId } }),
    ]);
    const groups = Array.isArray(owned.data) ? owned.data : [];
    setTrustGroups(groups);
    setSelectedGroupId((current) => (groups.some((item) => item.id === current) ? current : groups[0]?.id || ''));
    setJoinedGroups(Array.isArray(joined.data) ? joined.data : []);
  }, [myUserId]);

  useEffect(() => {
    if (!token) return;
    loadHistory().catch(() => {});
    loadTrustGroups().catch(() => {});
  }, [token, loadHistory, loadTrustGroups]);

  useEffect(() => {
    if (!invite?.token) {
      setInviteQr('');
      return;
    }
    QRCode.toDataURL(invite.inviteUrl || invite.token, { margin: 1, width: 240 }).then(setInviteQr).catch(() => setInviteQr(''));
  }, [invite]);

  const sendAlert = async () => {
    setBusy(true);
    try {
      const coords = await getCurrentPosition();
      await api.post(apiUrl('/incidents'), {
        incLatitud: coords.latitude,
        incLongitud: coords.longitude,
        incMotivo: motivo,
        incReportadoPor: `${user?.Nombre1 || ''} ${user?.Apellido1 || ''}`.trim() || user?.email,
        incUsuarioId: myUserId,
        incFacultad: user?.Facultad || 'FISEI',
      });
      setToast('Alerta enviada a seguridad.');
      await loadHistory();
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo enviar la alerta. Revisa GPS y red.'));
    } finally {
      setBusy(false);
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) return;
    setBusy(true);
    try {
      await api.post(apiUrl('/trust-groups'), { usuId: myUserId, nombre: groupName.trim() });
      setGroupName('');
      await loadTrustGroups();
      setToast('Grupo creado.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo crear el grupo.'));
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    if (!selectedGroupId || !memberInput.trim()) return;
    setBusy(true);
    try {
      const value = memberInput.trim();
      await api.post(apiUrl(`/trust-groups/${selectedGroupId}/members`), {
        usuId: myUserId,
        memberEmail: value.includes('@') ? value : '',
        memberUserId: value.includes('@') ? '' : value,
      });
      setMemberInput('');
      await loadTrustGroups();
      setToast('Miembro agregado.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo agregar el miembro.'));
    } finally {
      setBusy(false);
    }
  };

  const createInvite = async () => {
    if (!selectedGroupId) return;
    setBusy(true);
    try {
      const response = await api.post(apiUrl(`/trust-groups/${selectedGroupId}/invites`), {
        usuId: myUserId,
        expiresInMinutes: 15,
      });
      setInvite(response.data);
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo generar la invitacion.'));
    } finally {
      setBusy(false);
    }
  };

  const acceptInvite = async () => {
    if (!inviteTokenInput.trim()) return;
    setBusy(true);
    try {
      await api.post(apiUrl('/trust-groups/invites/accept'), {
        usuId: myUserId,
        token: inviteTokenInput.trim(),
      });
      setInviteTokenInput('');
      await loadTrustGroups();
      setToast('Te uniste al grupo.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo aceptar la invitacion.'));
    } finally {
      setBusy(false);
    }
  };

  const exit = () => {
    logout();
    history.replace('/login');
  };

  return (
    <Shell
      title={`${user?.Nombre1 || 'Estudiante'} ${user?.Apellido1 || ''}`.trim()}
      subtitle={`${user?.Facultad || 'UTA'} - ${user?.Rol || 'Estudiante'}`}
      actions={(
        <>
          <IonButton fill="clear" routerLink="/settings"><IonIcon icon={cogOutline} /></IonButton>
          <IonButton fill="clear" onClick={exit}><IonIcon icon={logOutOutline} /></IonButton>
        </>
      )}
    >
      <main className="page-pad">
        <IonSegment value={active} onIonChange={(e) => setActive(e.detail.value)}>
          <IonSegmentButton value="alert">Alerta</IonSegmentButton>
          <IonSegmentButton value="history">Historial</IonSegmentButton>
          <IonSegmentButton value="trust">Grupos</IonSegmentButton>
        </IonSegment>

        {active === 'alert' && (
          <section className="panel alert-panel">
            <IonNote>BOTON DE PANICO</IonNote>
            <h2>Reportar emergencia</h2>
            <IonSelect label="Motivo" labelPlacement="stacked" value={motivo} onIonChange={(e) => setMotivo(e.detail.value)}>
              {catalog.map((item) => <IonSelectOption key={item.value} value={item.value}>{item.label}</IonSelectOption>)}
            </IonSelect>
            <button className="panic-button" type="button" disabled={busy} onClick={sendAlert}>
              {busy ? <IonSpinner name="crescent" /> : <><IonIcon icon={alertCircleOutline} /> ALERTA</>}
            </button>
            <p className="muted">La app solicita ubicacion GPS y envia el incidente al gateway C#.</p>
          </section>
        )}

        {active === 'history' && (
          <section className="stack">
            <div className="section-row">
              <h2>Mis incidentes</h2>
              <IonButton size="small" fill="clear" onClick={() => Promise.all([loadHistory(), loadCatalog()])}><IonIcon icon={refreshOutline} /></IonButton>
            </div>
            {historyItems.length === 0 ? <EmptyState text="No tienes incidentes registrados." /> : historyItems.map((item) => (
              <IncidentCard key={item.incId} item={item} catalog={catalog} onOpen={() => history.push(`/incident/${item.incId}`, { item })} />
            ))}
          </section>
        )}

        {active === 'trust' && (
          <section className="stack">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Grupo de confianza</IonCardTitle>
                <IonCardSubtitle>Invita companeros para que reciban tus alertas.</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent className="stack">
                <IonInput label="Nombre del grupo" labelPlacement="stacked" value={groupName} onIonInput={(e) => setGroupName(e.detail.value || '')} />
                <IonButton expand="block" onClick={createGroup} disabled={busy}><IonIcon icon={addCircleOutline} slot="start" />Crear grupo</IonButton>
                <IonSelect label="Grupo seleccionado" labelPlacement="stacked" value={selectedGroupId} onIonChange={(e) => setSelectedGroupId(e.detail.value)}>
                  {trustGroups.map((group) => <IonSelectOption key={group.id} value={group.id}>{group.nombre}</IonSelectOption>)}
                </IonSelect>
                <IonInput label="Correo o ID del miembro" labelPlacement="stacked" value={memberInput} onIonInput={(e) => setMemberInput(e.detail.value || '')} />
                <IonButton expand="block" fill="outline" onClick={addMember} disabled={busy || !selectedGroupId}>Agregar miembro</IonButton>
                <IonButton expand="block" fill="outline" onClick={createInvite} disabled={busy || !selectedGroupId}><IonIcon icon={qrCodeOutline} slot="start" />Generar QR</IonButton>
              </IonCardContent>
            </IonCard>

            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Unirse a un grupo</IonCardTitle>
                <IonCardSubtitle>Ingresa el token o URL del QR.</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent className="stack">
                <IonTextarea label="Token / URL" labelPlacement="stacked" value={inviteTokenInput} onIonInput={(e) => setInviteTokenInput(e.detail.value || '')} />
                <IonButton expand="block" onClick={acceptInvite} disabled={busy}>Aceptar invitacion</IonButton>
              </IonCardContent>
            </IonCard>

            {trustGroups.map((group) => (
              <IonCard key={group.id}>
                <IonCardHeader>
                  <IonCardTitle>{group.nombre}</IonCardTitle>
                  <IonCardSubtitle>{group.miembros?.length || 0} miembros</IonCardSubtitle>
                </IonCardHeader>
                <IonList lines="full">
                  {(group.miembros || []).map((member) => (
                    <IonItem key={member.id}>
                      <IonIcon icon={peopleOutline} slot="start" />
                      <IonLabel>{member.nombre}<p>{member.email || member.usuId}</p></IonLabel>
                    </IonItem>
                  ))}
                </IonList>
              </IonCard>
            ))}

            <h2>Grupos a los que pertenezco</h2>
            {joinedGroups.length === 0 ? <EmptyState text="Aun no perteneces a otros grupos." /> : joinedGroups.map((group) => (
              <IonCard key={group.id}>
                <IonCardHeader>
                  <IonCardTitle>{group.nombre}</IonCardTitle>
                  <IonCardSubtitle>Creador: {group.propietario}</IonCardSubtitle>
                </IonCardHeader>
              </IonCard>
            ))}
          </section>
        )}
      </main>

      <IonModal isOpen={Boolean(invite)} onDidDismiss={() => setInvite(null)}>
        <Shell title="Invitacion QR" subtitle={invite?.grupoNombre || ''} actions={<IonButton fill="clear" onClick={() => setInvite(null)}><IonIcon icon={closeCircleOutline} /></IonButton>}>
          <main className="page-pad">
            <section className="panel stack qr-panel">
              {inviteQr ? <img src={inviteQr} alt="QR de invitacion" /> : null}
              <IonTextarea readonly value={invite?.inviteUrl || invite?.token || ''} />
              <IonButton expand="block" onClick={() => navigator.clipboard?.writeText(invite?.inviteUrl || invite?.token || '')}><IonIcon icon={copyOutline} slot="start" />Copiar invitacion</IonButton>
            </section>
          </main>
        </Shell>
      </IonModal>
      <Toast message={toast} color={toast.includes('No se') ? 'danger' : 'success'} onClose={() => setToast('')} />
    </Shell>
  );
}

function GuardPage() {
  const history = useHistory();
  const { user, token, logout } = useAuth();
  const { catalog, load: loadCatalog } = useIncidentTypes(token);
  const [active, setActive] = useState('alerts');
  const [alerts, setAlerts] = useState([]);
  const [isOnDuty, setIsOnDuty] = useState(true);
  const [rounds, setRounds] = useState([]);
  const [roundZone, setRoundZone] = useState('Zona 1');
  const [roundObservation, setRoundObservation] = useState('');
  const [closing, setClosing] = useState(null);
  const [closeObservation, setCloseObservation] = useState('No se encuentra en la Universidad');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const connectionRef = useRef(null);
  const myUserId = user?.id || '';

  const mapIncident = useCallback((item) => ({
    ...item,
    incEstado: String(item.incEstado || item.incSeveridad || 'PENDIENTE').toUpperCase(),
  }), []);

  const loadAlerts = useCallback(async () => {
    const response = await api.get(apiUrl('/incidents'));
    const items = Array.isArray(response.data) ? response.data : [];
    setAlerts(items.map(mapIncident));
  }, [mapIncident]);

  const loadDuty = useCallback(async () => {
    if (!myUserId) return;
    try {
      const response = await api.get(apiUrl(`/guard-duty/${myUserId}`));
      setIsOnDuty(response.data?.enServicio !== false);
    } catch {
      setIsOnDuty(true);
    }
  }, [myUserId]);

  const loadRounds = useCallback(async () => {
    if (!myUserId) return;
    const response = await api.get(apiUrl('/guard-rounds'), { params: { usuId: myUserId } });
    setRounds(Array.isArray(response.data) ? response.data : []);
  }, [myUserId]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadAlerts(), loadDuty(), loadRounds(), loadCatalog()]);
  }, [loadAlerts, loadDuty, loadRounds, loadCatalog]);

  useEffect(() => {
    refreshAll().catch(() => {});
  }, [refreshAll]);

  useEffect(() => {
    if (!myUserId) return undefined;
    const separator = hubUrl('/hubs/alerts').includes('?') ? '&' : '?';
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${hubUrl('/hubs/alerts')}${separator}userId=${encodeURIComponent(myUserId)}&role=Guardia`)
      .withAutomaticReconnect()
      .build();
    connectionRef.current = connection;
    connection.on('ReceiveAlert', (incident) => setAlerts((current) => [mapIncident(incident), ...current.filter((item) => item.incId !== incident.incId)]));
    connection.on('ReceiveIncidentUpdate', (update) => {
      setAlerts((current) => current.map((item) => item.incId === update.incId ? mapIncident({ ...item, ...update }) : item));
    });
    connection.start().catch(() => {});
    return () => {
      connection.off('ReceiveAlert');
      connection.off('ReceiveIncidentUpdate');
      connection.stop().catch(() => {});
    };
  }, [myUserId, mapIncident]);

  const toggleDuty = async () => {
    const next = !isOnDuty;
    setIsOnDuty(next);
    try {
      await api.put(apiUrl('/guard-duty'), { usuId: myUserId, enServicio: next });
    } catch (error) {
      setIsOnDuty(!next);
      setToast(getErrorMessage(error, 'No se pudo actualizar el turno.'));
    }
  };

  const acceptIncident = async (item) => {
    setBusy(true);
    try {
      await api.post(apiUrl('/incidents/accept'), { incId: item.incId, usuId: myUserId });
      await loadAlerts();
      setToast('Incidente asignado.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo aceptar el incidente.'));
    } finally {
      setBusy(false);
    }
  };

  const closeIncident = async () => {
    if (!closing || closeObservation.trim().length < 20) return;
    setBusy(true);
    try {
      await api.post(apiUrl('/incidents/close'), {
        incId: closing.incId,
        usuId: myUserId,
        incObservacion: closeObservation.trim(),
      });
      setClosing(null);
      setCloseObservation('No se encuentra en la Universidad');
      await loadAlerts();
      setToast('Incidente cerrado.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo cerrar el incidente.'));
    } finally {
      setBusy(false);
    }
  };

  const startRound = async () => {
    setBusy(true);
    try {
      await api.post(apiUrl('/guard-rounds/start'), { usuId: myUserId, zona: roundZone });
      await loadRounds();
      setToast('Ronda iniciada.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo iniciar la ronda.'));
    } finally {
      setBusy(false);
    }
  };

  const finishRound = async () => {
    const activeRound = rounds.find((round) => round.estado === 'EN_CURSO');
    if (!activeRound || !roundObservation.trim()) return;
    setBusy(true);
    try {
      await api.post(apiUrl('/guard-rounds/finish'), {
        rondaId: activeRound.rondaId,
        usuId: myUserId,
        observacion: roundObservation.trim(),
      });
      setRoundObservation('');
      await loadRounds();
      setToast('Ronda finalizada.');
    } catch (error) {
      setToast(getErrorMessage(error, 'No se pudo finalizar la ronda.'));
    } finally {
      setBusy(false);
    }
  };

  const activeAlerts = alerts.filter((item) => item.incEstado !== 'CERRADO');
  const historyAlerts = alerts.filter((item) => item.incEstado === 'CERRADO' || String(item.incAsignadoPor || '') === myUserId);
  const visibleAlerts = active === 'history' ? historyAlerts : activeAlerts;
  const activeRound = rounds.find((round) => round.estado === 'EN_CURSO');

  const exit = () => {
    logout();
    history.replace('/login');
  };

  return (
    <Shell
      title={`${user?.Nombre1 || 'Guardia'} ${user?.Apellido1 || ''}`.trim()}
      subtitle={isOnDuty ? 'En turno' : 'Fuera de turno'}
      actions={(
        <>
          <IonButton fill="clear" onClick={toggleDuty}><IonIcon icon={shieldCheckmarkOutline} /></IonButton>
          <IonButton fill="clear" routerLink="/settings"><IonIcon icon={cogOutline} /></IonButton>
          <IonButton fill="clear" onClick={exit}><IonIcon icon={logOutOutline} /></IonButton>
        </>
      )}
    >
      <main className="page-pad">
        <IonRefresher slot="fixed" onIonRefresh={(event) => refreshAll().finally(() => event.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <IonSegment value={active} onIonChange={(e) => setActive(e.detail.value)}>
          <IonSegmentButton value="alerts">Alertas</IonSegmentButton>
          <IonSegmentButton value="history">Historial</IonSegmentButton>
          <IonSegmentButton value="rounds">Rondas</IonSegmentButton>
        </IonSegment>

        {(active === 'alerts' || active === 'history') && (
          <section className="stack">
            {visibleAlerts.length === 0 ? <EmptyState text={active === 'alerts' ? 'No hay alertas activas.' : 'No hay acciones en historial.'} /> : visibleAlerts.map((item) => (
              <IncidentCard key={item.incId} item={item} catalog={catalog} onOpen={() => history.push(`/incident/${item.incId}`, { item })}>
                <div className="card-actions">
                  {item.incEstado === 'PENDIENTE' ? <IonButton size="small" onClick={() => acceptIncident(item)} disabled={busy}>Aceptar</IonButton> : null}
                  {item.incEstado !== 'CERRADO' ? <IonButton size="small" color="danger" fill="outline" onClick={() => setClosing(item)}>Cerrar</IonButton> : null}
                </div>
              </IncidentCard>
            ))}
          </section>
        )}

        {active === 'rounds' && (
          <section className="stack">
            <IonCard>
              <IonCardHeader>
                <IonCardTitle>Ronda de vigilancia</IonCardTitle>
                <IonCardSubtitle>{activeRound ? `En curso: ${activeRound.zona}` : 'Sin ronda activa'}</IonCardSubtitle>
              </IonCardHeader>
              <IonCardContent className="stack">
                <IonSelect label="Zona" labelPlacement="stacked" value={roundZone} onIonChange={(e) => setRoundZone(e.detail.value)}>
                  {['Zona 1', 'Zona 2', 'Zona 3', 'Zona 4', 'Zona 5'].map((zone) => <IonSelectOption key={zone} value={zone}>{zone}</IonSelectOption>)}
                </IonSelect>
                <IonButton expand="block" onClick={startRound} disabled={busy || Boolean(activeRound)}>Iniciar ronda</IonButton>
                <IonTextarea label="Observacion de cierre" labelPlacement="stacked" value={roundObservation} onIonInput={(e) => setRoundObservation(e.detail.value || '')} />
                <IonButton expand="block" color="success" onClick={finishRound} disabled={busy || !activeRound || !roundObservation.trim()}>Finalizar ronda</IonButton>
              </IonCardContent>
            </IonCard>
            {rounds.map((round) => (
              <IonCard key={round.rondaId}>
                <IonCardHeader>
                  <IonCardTitle>{round.zona}</IonCardTitle>
                  <IonCardSubtitle>{round.estado}</IonCardSubtitle>
                </IonCardHeader>
                <IonCardContent>{round.observacion || 'Sin observacion'}</IonCardContent>
              </IonCard>
            ))}
          </section>
        )}
      </main>

      <IonModal isOpen={Boolean(closing)} onDidDismiss={() => setClosing(null)}>
        <Shell title="Cerrar caso" subtitle={closing?.incZona || ''} actions={<IonButton fill="clear" onClick={() => setClosing(null)}><IonIcon icon={closeCircleOutline} /></IonButton>}>
          <main className="page-pad">
            <section className="panel stack">
              <IonTextarea label="Observacion" labelPlacement="stacked" value={closeObservation} onIonInput={(e) => setCloseObservation(e.detail.value || '')} />
              <IonNote>Minimo 20 caracteres.</IonNote>
              <IonButton expand="block" color="danger" onClick={closeIncident} disabled={busy || closeObservation.trim().length < 20}>Confirmar cierre</IonButton>
            </section>
          </main>
        </Shell>
      </IonModal>
      <Toast message={toast} color={toast.includes('No se') ? 'danger' : 'success'} onClose={() => setToast('')} />
    </Shell>
  );
}

function IncidentDetailPage() {
  const history = useHistory();
  const { id } = useParams();
  const item = history.location.state?.item;
  const [incident, setIncident] = useState(item || null);
  const [currentPosition, setCurrentPosition] = useState(null);

  useEffect(() => {
    if (incident) return;
    api.get(apiUrl('/incidents')).then((response) => {
      const found = (Array.isArray(response.data) ? response.data : []).find((entry) => entry.incId === id);
      setIncident(found || null);
    }).catch(() => {});
  }, [id, incident]);

  const lat = Number(incident?.incLatitud || 0);
  const lng = Number(incident?.incLongitud || 0);
  const mapsUrl = lat && lng ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : '';

  const locate = async () => {
    const coords = await getCurrentPosition();
    setCurrentPosition(coords);
  };

  return (
    <Shell
      title="Detalle"
      subtitle={incident?.incZona || 'Incidente'}
      actions={<IonButton fill="clear" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></IonButton>}
    >
      <main className="page-pad">
        {!incident ? <EmptyState text="No se encontro el incidente." /> : (
          <section className="panel stack">
            <IonIcon className="panel-icon danger" icon={alertCircleOutline} />
            <h2>{getIncidentByValue(incident.incMotivo).label}</h2>
            <InfoRow label="Estado" value={incident.incEstado || incident.incSeveridad || 'PENDIENTE'} />
            <InfoRow label="Zona" value={incident.incZona || incident.incGeocercaNombre || 'No disponible'} />
            <InfoRow label="Hora" value={formatDateTime(incident.incFechaReporte)} />
            <InfoRow label="Coordenadas" value={lat && lng ? `${lat}, ${lng}` : 'No disponible'} />
            {currentPosition ? <InfoRow label="Tu ubicacion" value={`${currentPosition.latitude}, ${currentPosition.longitude}`} /> : null}
            <IonButton expand="block" fill="outline" onClick={locate}><IonIcon icon={locateOutline} slot="start" />Obtener mi ubicacion</IonButton>
            {mapsUrl ? <IonButton expand="block" href={mapsUrl} target="_blank"><IonIcon icon={mapOutline} slot="start" />Abrir ruta en Maps</IonButton> : null}
          </section>
        )}
      </main>
    </Shell>
  );
}

function IncidentCard({ item, catalog, onOpen, children }) {
  const incident = getIncidentByValue(item.incMotivo, catalog);
  const status = String(item.incEstado || item.incSeveridad || 'PENDIENTE').toUpperCase();
  return (
    <IonCard className="incident-card">
      <IonCardHeader>
        <div className="incident-top">
          <div>
            <IonCardSubtitle>{item.incZona || item.incGeocercaNombre || 'Zona no disponible'}</IonCardSubtitle>
            <IonCardTitle>{incident.label}</IonCardTitle>
          </div>
          <IonBadge color={status === 'CERRADO' ? 'success' : status === 'ASIGNADO' ? 'warning' : 'danger'}>{status}</IonBadge>
        </div>
      </IonCardHeader>
      <IonCardContent>
        <p className="muted"><IonIcon icon={timeOutline} /> {formatDateTime(item.incFechaReporte)}</p>
        <p className="muted">{item.incReportadoPor || 'Usuario institucional'} - {item.incFacultad || 'UTA'}</p>
        <div className="card-actions">
          <IonButton size="small" fill="outline" onClick={onOpen}>Ver detalle</IonButton>
          {children}
        </div>
      </IonCardContent>
    </IonCard>
  );
}

function EmptyState({ text }) {
  return (
    <section className="empty-state">
      <IonIcon icon={checkmarkCircleOutline} />
      <p>{text}</p>
    </section>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

async function getCurrentPosition() {
  if (!navigator.geolocation) {
    throw new Error('El dispositivo no soporta geolocalizacion.');
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      }),
      () => reject(new Error('No se pudo obtener ubicacion GPS.')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  });
}

function RequireAuth({ children, role }) {
  const { user } = useAuth();
  if (!user) return <Redirect to="/login" />;
  if (role === 'Guardia' && user.rol !== 'Guardia') return <Redirect to="/student" />;
  if (role === 'Estudiante' && user.rol === 'Guardia') return <Redirect to="/guard" />;
  return children;
}

export default function App() {
  return (
    <IonApp>
      <AuthProvider>
        <IonReactRouter>
          <IonRouterOutlet>
            <Route exact path="/login" component={LoginPage} />
            <Route exact path="/register" component={RegisterPage} />
            <Route exact path="/settings" component={SettingsPage} />
            <Route exact path="/student">
              <RequireAuth role="Estudiante"><StudentPage /></RequireAuth>
            </Route>
            <Route exact path="/guard">
              <RequireAuth role="Guardia"><GuardPage /></RequireAuth>
            </Route>
            <Route exact path="/incident/:id">
              <RequireAuth><IncidentDetailPage /></RequireAuth>
            </Route>
            <Route exact path="/">
              <Redirect to="/login" />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      </AuthProvider>
    </IonApp>
  );
}
