import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { DEFAULT_TASKS } from '@/lib/constants';
import { monthKey, todayKey } from '@/lib/date';
import {
  canEditProject,
  getSharedProjectsStorageKey,
  usesSharedProjects,
} from '@/lib/projectPermissions';
import { isFirebaseConfigured } from '@/lib/firebase/config';
import { generateInviteCode } from '@/lib/clanLogic';
import {
  addClanRunDistance,
  createClanInFirestore,
  deleteClanMessageInFirestore,
  editClanMessageInFirestore,
  joinClanInFirestore,
  leaveClanInFirestore,
  sendClanMessageInFirestore,
  setClanMemberRole,
  updateClanMeta,
} from '@/lib/firebase/clanSync';
import { pullClansFromCloud } from '@/lib/firebase/clanListeners';
import { saveTeamProjects, type TeamProjectsTopic } from '@/lib/firebase/firestoreSync';
import { DEMO_ACCOUNTS, DEFAULT_TOPIC_ID, type TopicId } from '@/lib/topics';
import { captureRoadFromRun, routeLengthMeters } from '@/lib/geo';
import { hashPassword, verifyPassword } from '@/lib/password';
import { nextDevStage, normalizeDevStage } from '@/lib/projectStages';
import type {
  AccountingEntry,
  AccountingKind,
  AiChat,
  AiChatMessage,
  Clan,
  FoodEntry,
  ClanMember,
  ClanMessage,
  ClanRole,
  DevStage,
  HrEmployee,
  HrStatus,
  OnboardingProfile,
  Project,
  ProjectStatus,
  Territory,
  UserData,
  WarehouseItem,
} from '@/lib/types';
import {
  allTasksDoneToday,
  calculateStreak,
  checkNewDay,
  emptyUserData,
  isDayMarkedAchievement,
} from '@/lib/trackerLogic';
import { flushSaveUser, scheduleSaveUser } from '@/lib/firebase/debouncedSave';
import { collectLocalUserDataSnapshots, mergeUserData } from '@/lib/userDataMerge';
import {
  getBestRunDistance,
  notifyRunFinished,
  syncMotivationSchedule,
} from '@/lib/notifications/runMotivation';
import { saveRunnerStat } from '@/lib/firebase/runnerSync';
import { saveCyclistStat } from '@/lib/firebase/cyclistSync';
import { saveTerritoriesCollection } from '@/lib/firebase/firestoreSync';
import type { CyclistStat, RunnerStat } from '@/lib/types';

type State = {
  users: Record<string, string>;
  userData: Record<string, UserData>;
  /** Тематика по имени пользователя (sport | it) */
  userTopics: Record<string, TopicId>;
  currentUser: string | null;
  /** Firebase Auth uid при облачном входе */
  firebaseUid: string | null;
  /** URL аватара из Firebase / сессии (https) */
  profilePhotoURL: string | null;
  /** Локальный аватар (data URL), сохраняется в приложении — не пропадает после перезапуска */
  localAvatarDataUrl: string | null;
  /** false до первого onAuthStateChanged (Firebase) или сразу true без Firebase */
  authReady: boolean;
  territories: Territory[];
  runHistory: {
    id: string;
    user: string;
    startedAt: number;
    finishedAt: number;
    durationSec: number;
    distanceMeters: number;
    pointsCount: number;
  }[];
  clansById: Record<string, Clan>;
  clanMembersByClanId: Record<string, ClanMember[]>;
  clanMessagesByClanId: Record<string, ClanMessage[]>;
  clanLeaderboard: Clan[];
  activeClan: Clan | null;
  runnerLeaderboard: RunnerStat[];
  setRunnerLeaderboard: (list: RunnerStat[]) => void;
  cyclistLeaderboard: CyclistStat[];
  setCyclistLeaderboard: (list: CyclistStat[]) => void;
  /** Сохранённые чаты с ИИ */
  aiChats: AiChat[];
  activeAiChatId: string | null;
  setActiveAiChat: (id: string | null) => void;
  saveAiChat: (messages: AiChatMessage[]) => void;
  deleteAiChat: (id: string) => void;
  /** Журнал калорий (анализ еды) */
  foodLog: FoodEntry[];
  addFoodEntry: (e: Omit<FoodEntry, 'id' | 'at'>) => void;
  deleteFoodEntry: (id: string) => void;
  login: (username: string, password: string) => boolean;
  register: (username: string, password: string, topicId?: TopicId) => string | null;
  resetLocalPassword: (username: string, newPassword: string) => string | null;
  changeLocalPassword: (username: string, currentPassword: string, newPassword: string) => string | null;
  ensureDemoAccounts: () => void;
  getTopicId: (username: string | null) => TopicId;
  setUserTopic: (topicId: TopicId) => void;
  hydrateTeamProjects: (topic: TeamProjectsTopic, projects: Project[], remoteUpdatedAt?: number) => void;
  setActiveClan: (clan: Clan | null) => void;
  setClanMembers: (clanId: string, members: ClanMember[]) => void;
  setClanMessages: (clanId: string, messages: ClanMessage[]) => void;
  setClanLeaderboard: (clans: Clan[]) => void;
  ensureClanCatalog: () => void;
  refreshClanState: () => void;
  getClanId: () => string | null;
  createClan: (name: string) => Promise<string | null>;
  joinClanByCode: (code: string) => Promise<string | null>;
  leaveClan: () => Promise<string | null>;
  /** Назначить/снять роль участнику (только владелец) */
  setMemberRole: (targetUid: string, role: ClanRole) => Promise<string | null>;
  /** Эмодзи-логотип клана (только владелец) */
  setClanLogo: (emoji: string) => Promise<string | null>;
  sendClanMessage: (text: string) => Promise<string | null>;
  /** Редактировать своё сообщение */
  editClanMessage: (messageId: string, text: string) => Promise<string | null>;
  /** Удалить сообщение (автор, владелец или мотиватор) */
  deleteClanMessage: (messageId: string) => Promise<string | null>;
  recordClanRun: (distanceMeters: number) => void;
  logout: () => void;
  setAuthReady: (ready: boolean) => void;
  applyFirebaseSession: (
    email: string,
    uid: string,
    data: UserData,
    displayUsername: string,
    photoURL?: string | null,
    topicId?: TopicId
  ) => void;
  setProfilePhotoURL: (url: string | null) => void;
  setLocalAvatarDataUrl: (url: string | null) => void;
  /** После смены имени: ключ userData + владельцы территорий */
  migrateProfileIdentity: (oldName: string, newName: string, nextTerritories: Territory[]) => void;
  clearFirebaseSession: () => void;
  setTerritories: (t: Territory[]) => void;
  getUserData: (username: string) => UserData;
  setUserData: (username: string, data: UserData) => void;
  /** Сохранить/обновить анкету текущего пользователя (стор + Firestore) */
  saveOnboarding: (profile: OnboardingProfile) => void;
  syncNewDay: () => void;
  getStepsToday: () => number;
  setStepsToday: (n: number) => void;
  addTask: (name: string) => void;
  addTaskByName: (name: string) => void;
  toggleTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  addProject: (name: string, stack?: string) => void;
  addProjectFromTemplate: (name: string, stack: string) => void;
  bumpProjectProgress: (projectId: string, delta?: number) => void;
  cycleProjectStatus: (projectId: string) => void;
  cycleProjectDevStage: (projectId: string) => void;
  deleteProject: (projectId: string) => void;
  addAccountingEntry: (
    title: string,
    amount: number,
    kind: AccountingKind,
    category?: string
  ) => void;
  deleteAccountingEntry: (id: string) => void;
  addHrEmployee: (name: string, position: string, department: string) => void;
  cycleHrStatus: (id: string) => void;
  deleteHrEmployee: (id: string) => void;
  addWarehouseItem: (name: string, sku: string, qty: number, unit: string, minQty: number, location: string) => void;
  adjustWarehouseQty: (id: string, delta: number) => void;
  deleteWarehouseItem: (id: string) => void;
  markDayAsAchievement: () => void;
  markAllTasksToday: () => void;
  finishRun: (
    points: [number, number][],
    meta?: { startedAt?: number; finishedAt?: number; roadPoints?: [number, number][]; activity?: 'run' | 'bike' }
  ) => {
    captured: Territory[];
    takenOver: Territory[];
    message: string;
    detail: string;
  };
};

function ensureUserData(raw: UserData | undefined): UserData {
  if (!raw) return emptyUserData();
  return {
    tasks: raw.tasks || [],
    dailyDone: raw.dailyDone || {},
    monthAchievements: raw.monthAchievements || {},
    dailySteps: raw.dailySteps || {},
    projects: raw.projects || [],
    clanId: raw.clanId ?? null,
    onboarding: raw.onboarding,
    teamSyncAt: raw.teamSyncAt,
    totalRunMeters: raw.totalRunMeters,
    totalRuns: raw.totalRuns,
    totalBikeMeters: raw.totalBikeMeters,
    totalRides: raw.totalRides,
    accountingEntries: raw.accountingEntries || [],
    hrEmployees: raw.hrEmployees || [],
    warehouseItems: raw.warehouseItems || [],
    lastVisit: raw.lastVisit || todayKey(),
  };
}

function memberUid(firebaseUid: string | null, username: string): string {
  return firebaseUid ?? `local:${username}`;
}

function patchClanDistance(
  clansById: Record<string, Clan>,
  clanMembersByClanId: Record<string, ClanMember[]>,
  clanId: string,
  uid: string,
  deltaMeters: number
): { clansById: Record<string, Clan>; clanMembersByClanId: Record<string, ClanMember[]> } {
  const clan = clansById[clanId];
  if (!clan) return { clansById, clanMembersByClanId };
  const members = (clanMembersByClanId[clanId] || []).map((m) =>
    m.uid === uid ? { ...m, distanceMeters: (m.distanceMeters || 0) + deltaMeters } : m
  );
  return {
    clansById: {
      ...clansById,
      [clanId]: {
        ...clan,
        totalDistanceMeters: (clan.totalDistanceMeters || 0) + deltaMeters,
      },
    },
    clanMembersByClanId: { ...clanMembersByClanId, [clanId]: members },
  };
}

function rebuildLeaderboard(clansById: Record<string, Clan>): Clan[] {
  return Object.values(clansById).sort(
    (a, b) => (b.totalDistanceMeters || 0) - (a.totalDistanceMeters || 0)
  );
}

const DEMO_CLAN_ID = 'clan_demo_runners';

function buildDemoClanCatalog(): {
  clansById: Record<string, Clan>;
  clanMembersByClanId: Record<string, ClanMember[]>;
  clanMessagesByClanId: Record<string, ClanMessage[]>;
} {
  const now = Date.now();
  const clan: Clan = {
    id: DEMO_CLAN_ID,
    name: 'Бегуны',
    inviteCode: 'RUNNER',
    ownerUid: 'local:runner',
    ownerUsername: 'runner',
    totalDistanceMeters: 12400,
    memberCount: 2,
    createdAt: now,
  };
  return {
    clansById: { [DEMO_CLAN_ID]: clan },
    clanMembersByClanId: {
      [DEMO_CLAN_ID]: [
        {
          uid: 'local:runner',
          username: 'runner',
          role: 'owner',
          distanceMeters: 8200,
          joinedAt: now,
        },
        {
          uid: 'local:sprinter',
          username: 'sprinter',
          role: 'member',
          distanceMeters: 4200,
          joinedAt: now,
        },
      ],
    },
    clanMessagesByClanId: {
      [DEMO_CLAN_ID]: [
        {
          id: 'm_demo_1',
          uid: 'local:runner',
          username: 'runner',
          text: 'Кто сегодня на пробежку?',
          createdAt: now - 3600000,
        },
      ],
    },
  };
}

function resolveUserDataForTopic(
  raw: UserData | undefined,
  topicId: TopicId,
  allUserData: Record<string, UserData>
): UserData {
  const base = ensureUserData(raw);
  const sharedKey = getSharedProjectsStorageKey(topicId);
  if (!sharedKey) return base;
  const team = ensureUserData(allUserData[sharedKey]);
  return { ...base, projects: team.projects || [] };
}

function getSharedTeamData(get: () => State, topicId: TopicId): UserData {
  const key = getSharedProjectsStorageKey(topicId);
  if (!key) return emptyUserData();
  return ensureUserData(get().userData[key]);
}

function setSharedTeamProjects(
  get: () => State,
  set: (partial: Partial<State> | ((s: State) => Partial<State>)) => void,
  topicId: TopicId,
  projects: Project[]
) {
  const key = getSharedProjectsStorageKey(topicId);
  if (!key) return;
  const team = ensureUserData(get().userData[key]);
  const teamSyncAt = Date.now();
  set((s) => ({
    userData: {
      ...s.userData,
      [key]: { ...team, projects, teamSyncAt },
    },
  }));
}

export const useTrackerStore = create<State>()(
  persist(
    (set, get) => ({
      users: {},
      userData: {},
      userTopics: {},
      currentUser: null,
      firebaseUid: null,
      profilePhotoURL: null,
      localAvatarDataUrl: null,
      authReady: false,
      territories: [],
      runHistory: [],
      clansById: {},
      clanMembersByClanId: {},
      clanMessagesByClanId: {},
      clanLeaderboard: [],
      activeClan: null,
      runnerLeaderboard: [],
      setRunnerLeaderboard: (list) => set({ runnerLeaderboard: list }),
      cyclistLeaderboard: [],
      setCyclistLeaderboard: (list) => set({ cyclistLeaderboard: list }),
      aiChats: [],
      activeAiChatId: null,
      setActiveAiChat: (id) => set({ activeAiChatId: id }),
      saveAiChat: (messages) => {
        if (!messages.length) return;
        set((s) => {
          const now = Date.now();
          const title =
            messages.find((m) => m.role === 'user')?.content.slice(0, 48) || 'Новый чат';
          let id = s.activeAiChatId;
          let chats = [...s.aiChats];
          const idx = id ? chats.findIndex((c) => c.id === id) : -1;
          if (idx >= 0) {
            chats[idx] = { ...chats[idx], messages, updatedAt: now };
          } else {
            id = 'chat' + now;
            chats = [{ id, title, messages, updatedAt: now }, ...chats];
          }
          return { aiChats: chats.slice(0, 50), activeAiChatId: id };
        });
      },
      deleteAiChat: (id) =>
        set((s) => ({
          aiChats: s.aiChats.filter((c) => c.id !== id),
          activeAiChatId: s.activeAiChatId === id ? null : s.activeAiChatId,
        })),
      foodLog: [],
      addFoodEntry: (e) =>
        set((s) => ({
          foodLog: [{ id: 'food' + Date.now(), at: Date.now(), ...e }, ...s.foodLog].slice(0, 200),
        })),
      deleteFoodEntry: (id) => set((s) => ({ foodLog: s.foodLog.filter((f) => f.id !== id) })),

      setAuthReady: (ready) => set({ authReady: ready }),

      setActiveClan: (clan) =>
        set((s) => {
          const prevId = s.activeClan?.id ?? null;
          const nextId = clan?.id ?? null;
          if (prevId === nextId) return s;
          return { activeClan: clan };
        }),

      setClanMembers: (clanId, members) =>
        set((s) => {
          const prev = s.clanMembersByClanId[clanId];
          if (prev && prev.length === members.length) {
            let same = true;
            for (let i = 0; i < members.length; i++) {
              if (
                prev[i].uid !== members[i].uid ||
                prev[i].distanceMeters !== members[i].distanceMeters
              ) {
                same = false;
                break;
              }
            }
            if (same) return s;
          }
          return {
            clanMembersByClanId: { ...s.clanMembersByClanId, [clanId]: members },
          };
        }),

      setClanMessages: (clanId, messages) =>
        set((s) => {
          const prev = s.clanMessagesByClanId[clanId];
          // Учитываем не только id/длину, но и текст/editedAt — иначе правки не видны
          if (
            prev &&
            prev.length === messages.length &&
            prev.every(
              (m, i) =>
                m.id === messages[i]?.id &&
                m.text === messages[i]?.text &&
                m.editedAt === messages[i]?.editedAt
            )
          ) {
            return s;
          }
          return {
            clanMessagesByClanId: { ...s.clanMessagesByClanId, [clanId]: messages },
          };
        }),

      setClanLeaderboard: (clans) =>
        set((s) => {
          const same =
            s.clanLeaderboard.length === clans.length &&
            s.clanLeaderboard.every(
              (c, i) =>
                c.id === clans[i]?.id && c.totalDistanceMeters === clans[i]?.totalDistanceMeters
            );
          return same ? s : { clanLeaderboard: clans };
        }),

      ensureClanCatalog: () => {
        const existing = get().clansById;
        if (Object.keys(existing).length > 0) {
          return;
        }
        if (isFirebaseConfigured() && get().firebaseUid) {
          return;
        }
        const demo = buildDemoClanCatalog();
        set({
          clansById: demo.clansById,
          clanMembersByClanId: demo.clanMembersByClanId,
          clanMessagesByClanId: demo.clanMessagesByClanId,
          clanLeaderboard: rebuildLeaderboard(demo.clansById),
        });
        get().refreshClanState();
      },

      refreshClanState: () => {
        const user = get().currentUser;
        const clansById = get().clansById;
        const leaderboard = rebuildLeaderboard(clansById);
        let activeClan: Clan | null = null;
        if (user) {
          const id = get().getUserData(user).clanId;
          if (id && clansById[id]) activeClan = clansById[id];
        }
        set((s) => {
          const sameActive = (s.activeClan?.id ?? null) === (activeClan?.id ?? null);
          const sameBoard =
            s.clanLeaderboard.length === leaderboard.length &&
            s.clanLeaderboard.every(
              (c, i) =>
                c.id === leaderboard[i]?.id &&
                c.totalDistanceMeters === leaderboard[i]?.totalDistanceMeters
            );
          if (sameActive && sameBoard) return s;
          return { clanLeaderboard: leaderboard, activeClan };
        });
      },

      getClanId: () => {
        const user = get().currentUser;
        if (!user) return null;
        return get().getUserData(user).clanId ?? null;
      },

      setProfilePhotoURL: (url) => set({ profilePhotoURL: url }),

      setLocalAvatarDataUrl: (url) => set({ localAvatarDataUrl: url }),

      applyFirebaseSession: (email, uid, data, displayUsername, photoURL, topicId) => {
        const name = displayUsername.trim();
        const key = name.length > 0 ? name : email;
        const tid = topicId ?? DEFAULT_TOPIC_ID;
        const snapshot = get();
        const keysToMerge = new Set<string>([key]);
        if (email) keysToMerge.add(email);
        if (snapshot.currentUser) keysToMerge.add(snapshot.currentUser);

        const localMerged = collectLocalUserDataSnapshots(snapshot.userData, keysToMerge);
        const merged = mergeUserData(localMerged, ensureUserData(data));

        const nextUserData = { ...snapshot.userData, [key]: merged };
        for (const stale of keysToMerge) {
          if (stale !== key) delete nextUserData[stale];
        }

        set({
          currentUser: key,
          firebaseUid: uid,
          profilePhotoURL: photoURL ?? null,
          localAvatarDataUrl: snapshot.localAvatarDataUrl,
          userData: nextUserData,
          userTopics: { ...snapshot.userTopics, [key]: tid },
        });

        if (isFirebaseConfigured()) {
          void flushSaveUser(uid, key, merged, photoURL ?? snapshot.profilePhotoURL, tid).catch((e) =>
            console.warn('Firebase flush after session:', e)
          );
        }
      },

      getTopicId: (username) => {
        if (!username) return DEFAULT_TOPIC_ID;
        return get().userTopics[username] ?? DEFAULT_TOPIC_ID;
      },

      setUserTopic: (topicId) => {
        const user = get().currentUser;
        if (!user) return;
        set((s) => ({
          userTopics: { ...s.userTopics, [user]: topicId },
        }));
        const st = get();
        if (st.firebaseUid && isFirebaseConfigured()) {
          scheduleSaveUser(
            st.firebaseUid,
            user,
            st.getUserData(user),
            st.profilePhotoURL,
            topicId
          );
        }
      },

      createClan: async (name) => {
        const trimmed = name.trim();
        if (trimmed.length < 2) return 'Название клана минимум 2 символа';
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        if (isFirebaseConfigured() && !get().firebaseUid) {
          return 'Войдите по email (регистрация в приложении), чтобы клан был виден другим';
        }
        get().ensureClanCatalog();
        const data = get().getUserData(user);
        if (data.clanId) return 'Вы уже в клане. Сначала выйдите из текущего.';
        const uid = memberUid(get().firebaseUid, user);

        let clan: Clan;
        let member: ClanMember;
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            clan = await createClanInFirestore(trimmed, get().firebaseUid!, user);
            member = {
              uid,
              username: user,
              role: 'owner',
              distanceMeters: 0,
              joinedAt: clan.createdAt,
            };
          } catch (e) {
            return (e as Error)?.message ?? 'Не удалось создать клан в облаке';
          }
        } else {
          const clanId = 'clan_' + Date.now();
          const inviteCode = generateInviteCode();
          const now = Date.now();
          clan = {
            id: clanId,
            name: trimmed,
            inviteCode,
            ownerUid: uid,
            ownerUsername: user,
            totalDistanceMeters: 0,
            memberCount: 1,
            createdAt: now,
          };
          member = {
            uid,
            username: user,
            role: 'owner',
            distanceMeters: 0,
            joinedAt: now,
          };
        }

        const nextData = { ...data, clanId: clan.id };
        get().setUserData(user, nextData);
        set((s) => {
          const clansById = { ...s.clansById, [clan.id]: clan };
          return {
            clansById,
            clanMembersByClanId: { ...s.clanMembersByClanId, [clan.id]: [member] },
            clanMessagesByClanId: { ...s.clanMessagesByClanId, [clan.id]: [] },
            activeClan: clan,
            clanLeaderboard: rebuildLeaderboard(clansById),
          };
        });
        if (isFirebaseConfigured() && get().firebaseUid) {
          await pullClansFromCloud();
        }
        return null;
      },

      joinClanByCode: async (code) => {
        const key = code.trim().toUpperCase();
        if (key.length < 4) return 'Введите код приглашения';
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        if (isFirebaseConfigured() && !get().firebaseUid) {
          return 'Войдите по email, чтобы найти клан другого пользователя';
        }
        get().ensureClanCatalog();
        const data = get().getUserData(user);
        if (data.clanId) return 'Вы уже в клане';
        const uid = memberUid(get().firebaseUid, user);
        let clan: Clan | undefined;
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            const { findClanIdByInviteCode, findClanByInviteQuery, loadClan } = await import(
              '@/lib/firebase/clanSync'
            );
            let remoteId = await findClanIdByInviteCode(key);
            if (remoteId) clan = (await loadClan(remoteId)) ?? undefined;
            if (!clan) clan = (await findClanByInviteQuery(key)) ?? undefined;
          } catch (e) {
            console.warn('joinClan cloud lookup:', e);
          }
        }
        if (!clan) {
          clan = Object.values(get().clansById).find((c) => c.inviteCode === key);
        }
        if (!clan) return 'Клан с таким кодом не найден';
        if ((get().clanMembersByClanId[clan.id] || []).some((m) => m.uid === uid)) {
          const nextData = { ...data, clanId: clan.id };
          get().setUserData(user, nextData);
          set({ activeClan: clan });
          get().refreshClanState();
          return null;
        }
        const member: ClanMember = {
          uid,
          username: user,
          role: 'member',
          distanceMeters: 0,
          joinedAt: Date.now(),
        };
        const nextData = { ...data, clanId: clan.id };
        get().setUserData(user, nextData);
        set((s) => {
          const members = [...(s.clanMembersByClanId[clan.id] || []), member];
          const clansById = {
            ...s.clansById,
            [clan.id]: { ...clan, memberCount: (clan.memberCount || 0) + 1 },
          };
          return {
            clansById,
            clanMembersByClanId: { ...s.clanMembersByClanId, [clan.id]: members },
            activeClan: clansById[clan.id],
            clanLeaderboard: rebuildLeaderboard(clansById),
          };
        });
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await joinClanInFirestore(clan.id, get().firebaseUid!, user);
            await pullClansFromCloud();
          } catch (e) {
            console.warn('joinClan cloud:', e);
          }
        }
        return null;
      },

      leaveClan: async () => {
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const data = get().getUserData(user);
        const clanId = data.clanId;
        if (!clanId) return null;
        const uid = memberUid(get().firebaseUid, user);
        const clan = get().clansById[clanId] ?? get().activeClan;
        const isOwner = clan?.ownerUid === uid;
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await leaveClanInFirestore(clanId, get().firebaseUid!, !!isOwner);
          } catch (e) {
            console.warn('leaveClan cloud:', e);
          }
        }
        set((s) => {
          const members = (s.clanMembersByClanId[clanId] || []).filter((m) => m.uid !== uid);
          const dist =
            (s.clanMembersByClanId[clanId] || []).find((m) => m.uid === uid)?.distanceMeters || 0;
          const prev = s.clansById[clanId];
          const clansById = prev
            ? {
                ...s.clansById,
                [clanId]: {
                  ...prev,
                  memberCount: Math.max(0, (prev.memberCount || 1) - 1),
                  totalDistanceMeters: Math.max(0, (prev.totalDistanceMeters || 0) - dist),
                },
              }
            : s.clansById;
          return {
            clansById,
            clanMembersByClanId: { ...s.clanMembersByClanId, [clanId]: members },
            clanLeaderboard: rebuildLeaderboard(clansById),
          };
        });
        const nextData = { ...data, clanId: null };
        get().setUserData(user, nextData);
        set({ activeClan: null });
        get().refreshClanState();
        if (isFirebaseConfigured() && get().firebaseUid) {
          await pullClansFromCloud();
        }
        return null;
      },

      setMemberRole: async (targetUid, role) => {
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return 'Вы не в клане';
        const clan = get().clansById[clanId] ?? get().activeClan;
        const myUid = memberUid(get().firebaseUid, user);
        if (!clan || clan.ownerUid !== myUid) return 'Только владелец может менять роли';
        if (targetUid === clan.ownerUid) return 'Нельзя изменить роль владельца';
        if (role === 'owner') return 'Нельзя назначить владельца';
        set((s) => {
          const members = (s.clanMembersByClanId[clanId] || []).map((m) =>
            m.uid === targetUid ? { ...m, role } : m
          );
          return { clanMembersByClanId: { ...s.clanMembersByClanId, [clanId]: members } };
        });
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await setClanMemberRole(clanId, targetUid, role);
          } catch (e) {
            console.warn('setMemberRole cloud:', e);
          }
        }
        return null;
      },

      sendClanMessage: async (text) => {
        const trimmed = text.trim();
        if (!trimmed) return 'Введите сообщение';
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return 'Вы не в клане';
        const uid = memberUid(get().firebaseUid, user);
        const msgId = `m${Date.now()}`;
        const createdAt = Date.now();
        const msg: ClanMessage = {
          id: msgId,
          uid,
          username: user,
          text: trimmed,
          createdAt,
        };
        set((s) => ({
          clanMessagesByClanId: {
            ...s.clanMessagesByClanId,
            [clanId]: [...(s.clanMessagesByClanId[clanId] || []), msg],
          },
        }));
        if (isFirebaseConfigured() && get().firebaseUid) {
          const firebaseUid = get().firebaseUid!;
          try {
            const { loadClanMemberPushTokens } = await import('@/lib/firebase/clanSync');
            const { notifyClanMembersOnMessage } = await import('@/lib/notifications/sendClanPush');
            const tokensP = loadClanMemberPushTokens(clanId, firebaseUid);
            const saveP = sendClanMessageInFirestore(
              clanId,
              firebaseUid,
              user,
              trimmed,
              msgId,
              createdAt
            );
            const [, targets] = await Promise.all([saveP, tokensP]);
            await notifyClanMembersOnMessage(user, trimmed, targets, clanId);
          } catch (e) {
            console.warn('sendClanMessage cloud:', e);
          }
        }
        return null;
      },

      editClanMessage: async (messageId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return 'Введите сообщение';
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return 'Вы не в клане';
        const uid = memberUid(get().firebaseUid, user);
        const msg = (get().clanMessagesByClanId[clanId] || []).find((m) => m.id === messageId);
        if (!msg) return 'Сообщение не найдено';
        if (msg.uid !== uid) return 'Можно редактировать только свои сообщения';
        set((s) => ({
          clanMessagesByClanId: {
            ...s.clanMessagesByClanId,
            [clanId]: (s.clanMessagesByClanId[clanId] || []).map((m) =>
              m.id === messageId ? { ...m, text: trimmed, editedAt: Date.now() } : m
            ),
          },
        }));
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await editClanMessageInFirestore(clanId, messageId, trimmed);
          } catch (e) {
            console.warn('editClanMessage cloud:', e);
          }
        }
        return null;
      },

      deleteClanMessage: async (messageId) => {
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return 'Вы не в клане';
        const uid = memberUid(get().firebaseUid, user);
        const clan = get().clansById[clanId] ?? get().activeClan;
        const myRole = (get().clanMembersByClanId[clanId] || []).find((m) => m.uid === uid)?.role;
        const msg = (get().clanMessagesByClanId[clanId] || []).find((m) => m.id === messageId);
        if (!msg) return null;
        const isModerator = clan?.ownerUid === uid || myRole === 'motivator';
        if (msg.uid !== uid && !isModerator) return 'Нет прав удалить это сообщение';
        set((s) => ({
          clanMessagesByClanId: {
            ...s.clanMessagesByClanId,
            [clanId]: (s.clanMessagesByClanId[clanId] || []).filter((m) => m.id !== messageId),
          },
        }));
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await deleteClanMessageInFirestore(clanId, messageId);
          } catch (e) {
            console.warn('deleteClanMessage cloud:', e);
          }
        }
        return null;
      },

      setClanLogo: async (emoji) => {
        const user = get().currentUser;
        if (!user) return 'Войдите в аккаунт';
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return 'Вы не в клане';
        const clan = get().clansById[clanId] ?? get().activeClan;
        const uid = memberUid(get().firebaseUid, user);
        if (!clan || clan.ownerUid !== uid) return 'Только владелец может менять логотип';
        set((s) => {
          const prev = s.clansById[clanId];
          const clansById = prev ? { ...s.clansById, [clanId]: { ...prev, emoji } } : s.clansById;
          return {
            clansById,
            activeClan:
              s.activeClan && s.activeClan.id === clanId ? { ...s.activeClan, emoji } : s.activeClan,
            clanLeaderboard: rebuildLeaderboard(clansById),
          };
        });
        if (isFirebaseConfigured() && get().firebaseUid) {
          try {
            await updateClanMeta(clanId, { emoji });
          } catch (e) {
            console.warn('setClanLogo cloud:', e);
          }
        }
        return null;
      },

      recordClanRun: (distanceMeters) => {
        const meters = Math.round(distanceMeters);
        if (meters <= 0) return;
        const user = get().currentUser;
        if (!user) return;
        const clanId = get().getUserData(user).clanId;
        if (!clanId) return;
        const uid = memberUid(get().firebaseUid, user);
        set((s) => {
          const patched = patchClanDistance(s.clansById, s.clanMembersByClanId, clanId, uid, meters);
          const activeClan = patched.clansById[clanId] ?? s.activeClan;
          return {
            ...patched,
            activeClan,
            clanLeaderboard: rebuildLeaderboard(patched.clansById),
          };
        });
        if (isFirebaseConfigured() && get().firebaseUid) {
          void addClanRunDistance(clanId, get().firebaseUid!, user, meters).catch((e) =>
            console.warn('addClanRunDistance:', e)
          );
        }
      },

      hydrateTeamProjects: (topic, projects, remoteUpdatedAt = 0) => {
        const key = getSharedProjectsStorageKey(topic as unknown as TopicId);
        if (!key) return;
        const team = ensureUserData(get().userData[key]);
        const existing = team.projects || [];
        const localSyncAt = team.teamSyncAt ?? 0;
        if (remoteUpdatedAt > 0 && remoteUpdatedAt < localSyncAt) return;
        if (projects.length === 0 && existing.length > 0 && remoteUpdatedAt <= localSyncAt) return;
        set((s) => ({
          userData: {
            ...s.userData,
            [key]: {
              ...team,
              projects,
              teamSyncAt: remoteUpdatedAt > 0 ? remoteUpdatedAt : localSyncAt,
            },
          },
        }));
      },

      ensureDemoAccounts: () => {
        let users = { ...get().users };
        let userData = { ...get().userData };
        let userTopics = { ...get().userTopics };
        let changed = false;
        for (const demo of DEMO_ACCOUNTS) {
          if (!users[demo.username]) {
            users[demo.username] = hashPassword(demo.password);
            userData[demo.username] = emptyUserData();
            userTopics[demo.username] = demo.topicId;
            changed = true;
          } else if (userTopics[demo.username] !== demo.topicId) {
            userTopics[demo.username] = demo.topicId;
            changed = true;
          }
        }
        if (changed) set({ users, userData, userTopics });
        get().ensureClanCatalog();
      },

      migrateProfileIdentity: (oldName, newName, nextTerritories) =>
        set((s) => {
          const ud = { ...s.userData };
          if (ud[oldName]) {
            ud[newName] = ud[oldName];
            delete ud[oldName];
          }
          const topics = { ...s.userTopics };
          if (topics[oldName]) {
            topics[newName] = topics[oldName];
            delete topics[oldName];
          }
          return {
            currentUser: newName,
            userData: ud,
            userTopics: topics,
            territories: nextTerritories,
          };
        }),

      clearFirebaseSession: () =>
        set({
          currentUser: null,
          firebaseUid: null,
          profilePhotoURL: null,
          localAvatarDataUrl: null,
        }),

      setTerritories: (territories) => set({ territories }),

      login: (username, password) => {
        const users = get().users;
        const stored = users[username.trim()];
        if (!stored) return false;
        if (!verifyPassword(password, stored)) return false;
        set({ currentUser: username.trim() });
        get().syncNewDay();
        get().ensureClanCatalog();
        get().refreshClanState();
        return true;
      },

      register: (username, password, topicId = DEFAULT_TOPIC_ID) => {
        const u = username.trim();
        if (u.length < 2) return 'Имя пользователя минимум 2 символа';
        if (password.length < 4) return 'Пароль минимум 4 символа';
        const users = { ...get().users };
        if (users[u]) return 'Такой пользователь уже есть';
        users[u] = hashPassword(password);
        const ud = { ...get().userData, [u]: emptyUserData() };
        const userTopics = { ...get().userTopics, [u]: topicId };
        set({ users, userData: ud, userTopics, currentUser: u });
        get().syncNewDay();
        get().ensureClanCatalog();
        get().refreshClanState();
        return null;
      },

      resetLocalPassword: (username, newPassword) => {
        const u = username.trim();
        if (u.length < 2) return 'Введите имя пользователя';
        if (newPassword.length < 4) return 'Пароль минимум 4 символа';
        const users = { ...get().users };
        if (!users[u]) return 'Пользователь не найден';
        users[u] = hashPassword(newPassword);
        set({ users });
        return null;
      },

      changeLocalPassword: (username, currentPassword, newPassword) => {
        const u = username.trim();
        if (u.length < 2) return 'Введите имя пользователя';
        if (newPassword.length < 4) return 'Пароль минимум 4 символа';
        const users = { ...get().users };
        const stored = users[u];
        if (!stored) return 'Пользователь не найден';
        if (!verifyPassword(currentPassword, stored)) return 'Неверный текущий пароль';
        users[u] = hashPassword(newPassword);
        set({ users });
        return null;
      },

      logout: () =>
        set({ currentUser: null, firebaseUid: null, profilePhotoURL: null, localAvatarDataUrl: null }),

      getUserData: (username) => ensureUserData(get().userData[username]),

      setUserData: (username, data) => {
        set((s) => ({
          userData: { ...s.userData, [username]: data },
        }));
        const st = get();
        if (st.firebaseUid && st.currentUser === username && isFirebaseConfigured()) {
          scheduleSaveUser(st.firebaseUid, username, data, st.profilePhotoURL, get().getTopicId(username));
        }
      },

      saveOnboarding: (profile) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user), onboarding: profile };
        get().setUserData(user, data);
      },

      syncNewDay: () => {
        const user = get().currentUser;
        if (!user) return;
        const raw = ensureUserData(get().userData[user]);
        const updated = checkNewDay(raw);
        get().setUserData(user, updated);
      },

      getStepsToday: () => {
        const user = get().currentUser;
        if (!user) return 0;
        const data = get().getUserData(user);
        const t = todayKey();
        return (data.dailySteps || {})[t] || 0;
      },

      setStepsToday: (n) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        if (!data.dailySteps) data.dailySteps = {};
        data.dailySteps = { ...data.dailySteps, [todayKey()]: Math.max(0, Math.floor(n)) };
        get().setUserData(user, data);
      },

      addTask: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.tasks = [...(data.tasks || [])];
        data.tasks.push({ id: 't' + Date.now(), name: trimmed });
        get().setUserData(user, data);
      },

      addTaskByName: (name) => {
        get().addTask(name);
      },

      toggleTask: (taskId) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const today = todayKey();
        let done = [...(data.dailyDone[today] || [])];
        if (done.includes(taskId)) done = done.filter((id) => id !== taskId);
        else done = [...done, taskId];
        data.dailyDone = { ...data.dailyDone, [today]: done };
        get().setUserData(user, data);
        if (allTasksDoneToday(data) && !isDayMarkedAchievement(data, today)) {
          setTimeout(() => get().markDayAsAchievement(), 500);
        }
      },

      deleteTask: (taskId) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.tasks = (data.tasks || []).filter((t) => t.id !== taskId);
        const dd = { ...data.dailyDone };
        Object.keys(dd).forEach((day) => {
          dd[day] = (dd[day] || []).filter((id) => id !== taskId);
        });
        data.dailyDone = dd;
        get().setUserData(user, data);
      },

      addProject: (name, stack = '') => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const user = get().currentUser;
        if (!user) return;
        const topicId = get().getTopicId(user);
        const uid = get().firebaseUid;
        const project: Project = {
          id: 'p' + Date.now(),
          name: trimmed,
          stack: stack.trim(),
          progress: 0,
          status: 'active',
          devStage: 'idea' as DevStage,
          createdAt: todayKey(),
          createdBy: usesSharedProjects(topicId) ? user : undefined,
          createdByUid: usesSharedProjects(topicId) ? uid ?? undefined : undefined,
        };
        if (usesSharedProjects(topicId)) {
          const team = getSharedTeamData(get, topicId);
          setSharedTeamProjects(get, set, topicId, [...(team.projects || []), project]);
          return;
        }
        const data = { ...get().getUserData(user) };
        data.projects = [...(data.projects || []), project];
        get().setUserData(user, data);
      },

      addProjectFromTemplate: (name, stack) => {
        get().addProject(name, stack);
      },

      bumpProjectProgress: (projectId, delta = 10) => {
        const user = get().currentUser;
        if (!user) return;
        const topicId = get().getTopicId(user);
        const mapProjects = (projects: Project[]): Project[] =>
          projects.map((p) => {
            if (p.id !== projectId) return p;
            if (!canEditProject(p, topicId, user, get().firebaseUid)) return p;
            const next = Math.min(100, Math.max(0, p.progress + delta));
            const status: ProjectStatus = next >= 100 ? 'done' : p.status === 'done' ? 'active' : p.status;
            return { ...p, progress: next, status };
          });
        if (usesSharedProjects(topicId)) {
          const team = getSharedTeamData(get, topicId);
          const target = (team.projects || []).find((p) => p.id === projectId);
          if (!target || !canEditProject(target, topicId, user, get().firebaseUid)) return;
          setSharedTeamProjects(get, set, topicId, mapProjects(team.projects || []));
          return;
        }
        const data = { ...get().getUserData(user) };
        data.projects = mapProjects(data.projects || []);
        get().setUserData(user, data);
      },

      cycleProjectStatus: (projectId) => {
        const user = get().currentUser;
        if (!user) return;
        const topicId = get().getTopicId(user);
        const order: ProjectStatus[] = ['active', 'paused', 'done'];
        const mapProjects = (projects: Project[]) =>
          projects.map((p) => {
            if (p.id !== projectId) return p;
            if (!canEditProject(p, topicId, user, get().firebaseUid)) return p;
            const idx = order.indexOf(p.status);
            const next = order[(idx + 1) % order.length];
            return {
              ...p,
              status: next,
              progress: next === 'done' ? 100 : next === 'active' && p.progress >= 100 ? 90 : p.progress,
            };
          });
        if (usesSharedProjects(topicId)) {
          const team = getSharedTeamData(get, topicId);
          const target = (team.projects || []).find((p) => p.id === projectId);
          if (!target || !canEditProject(target, topicId, user, get().firebaseUid)) return;
          setSharedTeamProjects(get, set, topicId, mapProjects(team.projects || []));
          return;
        }
        const data = { ...get().getUserData(user) };
        data.projects = mapProjects(data.projects || []);
        get().setUserData(user, data);
      },

      cycleProjectDevStage: (projectId) => {
        const user = get().currentUser;
        if (!user) return;
        const topicId = get().getTopicId(user);
        const mapProjects = (projects: Project[]) =>
          projects.map((p) => {
            if (p.id !== projectId) return p;
            if (!canEditProject(p, topicId, user, get().firebaseUid)) return p;
            return { ...p, devStage: nextDevStage(normalizeDevStage(p.devStage)) };
          });
        if (usesSharedProjects(topicId)) {
          const team = getSharedTeamData(get, topicId);
          const target = (team.projects || []).find((p) => p.id === projectId);
          if (!target || !canEditProject(target, topicId, user, get().firebaseUid)) return;
          setSharedTeamProjects(get, set, topicId, mapProjects(team.projects || []));
          return;
        }
        const data = { ...get().getUserData(user) };
        data.projects = mapProjects(data.projects || []);
        get().setUserData(user, data);
      },

      deleteProject: (projectId) => {
        const user = get().currentUser;
        if (!user) return;
        const topicId = get().getTopicId(user);
        if (usesSharedProjects(topicId)) {
          const team = getSharedTeamData(get, topicId);
          const target = (team.projects || []).find((p) => p.id === projectId);
          if (!target || !canEditProject(target, topicId, user, get().firebaseUid)) return;
          setSharedTeamProjects(
            get,
            set,
            topicId,
            (team.projects || []).filter((p) => p.id !== projectId)
          );
          return;
        }
        const data = { ...get().getUserData(user) };
        data.projects = (data.projects || []).filter((p) => p.id !== projectId);
        get().setUserData(user, data);
      },

      addAccountingEntry: (title, amount, kind, category = '') => {
        const trimmed = title.trim();
        if (!trimmed || amount <= 0) return;
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const list: AccountingEntry[] = [...(data.accountingEntries || [])];
        list.push({
          id: 'a' + Date.now(),
          title: trimmed,
          amount: Math.round(amount * 100) / 100,
          kind,
          category: category.trim(),
          date: todayKey(),
        });
        data.accountingEntries = list;
        get().setUserData(user, data);
      },

      deleteAccountingEntry: (id) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.accountingEntries = (data.accountingEntries || []).filter((e) => e.id !== id);
        get().setUserData(user, data);
      },

      addHrEmployee: (name, position, department) => {
        const n = name.trim();
        if (!n) return;
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const list: HrEmployee[] = [...(data.hrEmployees || [])];
        list.push({
          id: 'h' + Date.now(),
          name: n,
          position: position.trim(),
          department: department.trim(),
          status: 'active',
          hiredAt: todayKey(),
        });
        data.hrEmployees = list;
        get().setUserData(user, data);
      },

      cycleHrStatus: (id) => {
        const user = get().currentUser;
        if (!user) return;
        const order: HrStatus[] = ['active', 'vacation', 'candidate', 'offboard'];
        const data = { ...get().getUserData(user) };
        data.hrEmployees = (data.hrEmployees || []).map((e) => {
          if (e.id !== id) return e;
          const idx = order.indexOf(e.status);
          return { ...e, status: order[(idx + 1) % order.length] };
        });
        get().setUserData(user, data);
      },

      deleteHrEmployee: (id) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.hrEmployees = (data.hrEmployees || []).filter((e) => e.id !== id);
        get().setUserData(user, data);
      },

      addWarehouseItem: (name, sku, qty, unit, minQty, location) => {
        const n = name.trim();
        if (!n) return;
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const list: WarehouseItem[] = [...(data.warehouseItems || [])];
        list.push({
          id: 'w' + Date.now(),
          name: n,
          sku: sku.trim(),
          qty: Math.max(0, Math.floor(qty)),
          unit: unit.trim() || 'шт',
          minQty: Math.max(0, Math.floor(minQty)),
          location: location.trim(),
        });
        data.warehouseItems = list;
        get().setUserData(user, data);
      },

      adjustWarehouseQty: (id, delta) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.warehouseItems = (data.warehouseItems || []).map((item) => {
          if (item.id !== id) return item;
          return { ...item, qty: Math.max(0, item.qty + delta) };
        });
        get().setUserData(user, data);
      },

      deleteWarehouseItem: (id) => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        data.warehouseItems = (data.warehouseItems || []).filter((item) => item.id !== id);
        get().setUserData(user, data);
      },

      markDayAsAchievement: () => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const today = todayKey();
        const [y, m, d] = today.split('-');
        const key = monthKey(parseInt(y, 10), parseInt(m, 10));
        const monthAch = { ...(data.monthAchievements || {}) };
        const arr = [...(monthAch[key] || [])];
        const dayNum = parseInt(d, 10);
        if (!arr.includes(dayNum)) arr.push(dayNum);
        monthAch[key] = arr;
        data.monthAchievements = monthAch;
        get().setUserData(user, data);
      },

      markAllTasksToday: () => {
        const user = get().currentUser;
        if (!user) return;
        const data = { ...get().getUserData(user) };
        const tasks = data.tasks || [];
        const today = todayKey();
        data.dailyDone = { ...data.dailyDone, [today]: tasks.map((t) => t.id) };
        get().setUserData(user, data);
        get().markDayAsAchievement();
      },

      finishRun: (runPoints, meta) => {
        const user = get().currentUser;
        if (!user)
          return {
            captured: [],
            takenOver: [],
            message: 'Войдите в аккаунт',
            detail: '',
          };
        if (runPoints.length < 5) {
          return {
            captured: [],
            takenOver: [],
            message: 'Мало точек GPS. Пробегите больше и попробуйте снова.',
            detail: '',
          };
        }
        const roadPoints = meta?.roadPoints && meta.roadPoints.length >= 2 ? meta.roadPoints : runPoints;
        const { captured, takenOver, nextTerritories } = captureRoadFromRun(
          roadPoints,
          user,
          get().territories
        );
        const finishedAt = meta?.finishedAt ?? Date.now();
        const startedAt = meta?.startedAt ?? finishedAt;
        const durationSec = Math.max(0, Math.floor((finishedAt - startedAt) / 1000));
        const distanceMeters = routeLengthMeters(runPoints);
        const previousBestMeters = getBestRunDistance(
          get().runHistory.filter((r) => r.user === user),
          user
        );
        const runItem = {
          id: user + '-' + finishedAt,
          user,
          startedAt,
          finishedAt,
          durationSec,
          distanceMeters: Math.max(0, Math.round(distanceMeters)),
          pointsCount: runPoints.length,
        };
        const trimmedHistory = [runItem, ...get().runHistory].slice(0, 300);
        const metersRounded = Math.max(0, Math.round(distanceMeters));
        const activity = meta?.activity ?? 'run';
        const ud = { ...get().getUserData(user) };
        if (activity === 'bike') {
          ud.totalBikeMeters = (ud.totalBikeMeters || 0) + metersRounded;
          ud.totalRides = (ud.totalRides || 0) + 1;
        } else {
          ud.totalRunMeters = (ud.totalRunMeters || 0) + metersRounded;
          ud.totalRuns = (ud.totalRuns || 0) + 1;
        }
        get().setUserData(user, ud);
        set({ territories: nextTerritories, runHistory: trimmedHistory });
        get().recordClanRun(metersRounded);
        void notifyRunFinished(user, metersRounded, previousBestMeters).catch((e) =>
          console.warn('notifyRunFinished:', e)
        );
        void syncMotivationSchedule(user, trimmedHistory).catch((e) =>
          console.warn('syncMotivationSchedule:', e)
        );
        const st = get();
        if (isFirebaseConfigured()) {
          void saveTerritoriesCollection(nextTerritories).catch((e) =>
            console.warn('Firebase territories:', e)
          );
          const uid = st.firebaseUid;
          if (uid) {
            if (activity === 'bike') {
              void saveCyclistStat(uid, user, metersRounded).catch((e) =>
                console.warn('saveCyclistStat:', e)
              );
            } else {
              void saveRunnerStat(uid, user, metersRounded).catch((e) =>
                console.warn('saveRunnerStat:', e)
              );
            }
            void flushSaveUser(
              uid,
              user,
              ud,
              st.profilePhotoURL,
              get().getTopicId(user)
            ).catch((e) => console.warn('flushSaveUser after run:', e));
          }
        }
        let message = '';
        let detail = '';
        if (captured.length > 0 && takenOver.length > 0) {
          message = 'Захвачено! Новая территория + перехвачено дорог: ' + takenOver.length;
          detail = 'Новых участков: ' + captured.length + '. Защищено/перехвачено: ' + takenOver.length;
        } else if (takenOver.length > 0) {
          message = 'Перехват! Вы забрали ' + takenOver.length + ' дорог.';
          detail = 'Пробегайте эти участки снова, чтобы удерживать их.';
        } else if (captured.length > 0) {
          message = 'Новая территория захвачена!';
          const c0 = captured[0];
          detail =
            'Длина участка: ' +
            (c0.lengthMeters >= 1000
              ? (c0.lengthMeters / 1000).toFixed(2) + ' км'
              : Math.round(c0.lengthMeters) + ' м');
        } else {
          message = 'Маршрут записан.';
          detail = 'Участок короче 100 м не засчитывается. Пробегите длиннее для захвата.';
        }
        const km =
          metersRounded >= 1000
            ? (metersRounded / 1000).toFixed(2) + ' км'
            : metersRounded + ' м';
        detail += (detail ? '\n' : '') + 'Пробег: ' + km + ' — учтено в рейтинге и клане.';
        return { captured, takenOver, message, detail };
      },
    }),
    {
      name: 'tracker-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        users: s.users,
        userData: s.userData,
        userTopics: s.userTopics,
        currentUser: s.currentUser,
        firebaseUid: s.firebaseUid,
        profilePhotoURL: s.profilePhotoURL,
        localAvatarDataUrl: s.localAvatarDataUrl,
        territories: s.territories,
        runHistory: s.runHistory,
        runnerLeaderboard: s.runnerLeaderboard,
        cyclistLeaderboard: s.cyclistLeaderboard,
        aiChats: s.aiChats,
        activeAiChatId: s.activeAiChatId,
        foodLog: s.foodLog,
        clansById: s.clansById,
        clanMembersByClanId: s.clanMembersByClanId,
        clanMessagesByClanId: s.clanMessagesByClanId,
      }),
    }
  )
);

/** Дождаться загрузки AsyncStorage — иначе Firebase затирает локальные цели пустым облаком. */
export function waitForStoreHydration(): Promise<void> {
  return new Promise((resolve) => {
    if (useTrackerStore.persist.hasHydrated()) {
      resolve();
      return;
    }
    const unsub = useTrackerStore.persist.onFinishHydration(() => {
      unsub();
      resolve();
    });
  });
}

/** Аватар для UI: сначала локальный (сохранённый в приложении), иначе из профиля/Firebase */
export function selectAvatarDisplayUri(s: {
  localAvatarDataUrl: string | null;
  profilePhotoURL: string | null;
}): string | null {
  return s.localAvatarDataUrl ?? s.profilePhotoURL;
}

export function useStreak(): number {
  const user = useTrackerStore((s) => s.currentUser);
  const raw = useTrackerStore((s) => (user ? s.userData[user] : undefined));
  if (!user || !raw) return 0;
  return calculateStreak(ensureUserData(raw));
}

export function useUserData(): UserData | null {
  const user = useTrackerStore((s) => s.currentUser);
  const raw = useTrackerStore((s) => (user ? s.userData[user] : undefined));
  const topicId = useTrackerStore((s) => (user ? s.userTopics[user] ?? DEFAULT_TOPIC_ID : DEFAULT_TOPIC_ID));
  const allUserData = useTrackerStore((s) => s.userData);
  if (!user) return null;
  return resolveUserDataForTopic(raw, topicId, allUserData);
}

export { DEFAULT_TASKS };
export type {
  AccountingEntry,
  Clan,
  ClanMember,
  ClanMessage,
  DevStage,
  HrEmployee,
  Project,
  ProjectStatus,
  Task,
  Territory,
  UserData,
  WarehouseItem,
} from '@/lib/types';
