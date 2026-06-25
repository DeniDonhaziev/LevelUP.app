export type Task = { id: string; name: string };

export type ProjectStatus = 'active' | 'done' | 'paused';

/** Стадия разработки — видна всем в общем списке проектов */
export type DevStage = 'idea' | 'design' | 'dev' | 'qa' | 'release';

export type Project = {
  id: string;
  name: string;
  stack: string;
  progress: number;
  status: ProjectStatus;
  /** Стадия разработки (IT / менеджмент) */
  devStage?: DevStage;
  createdAt: string;
  /** Отображаемое имя создателя */
  createdBy?: string;
  /** Firebase uid создателя (для прав при облачном входе) */
  createdByUid?: string;
};

export type AccountingKind = 'income' | 'expense';

export type AccountingEntry = {
  id: string;
  title: string;
  amount: number;
  kind: AccountingKind;
  category: string;
  date: string;
};

export type HrStatus = 'active' | 'vacation' | 'candidate' | 'offboard';

export type HrEmployee = {
  id: string;
  name: string;
  position: string;
  department: string;
  status: HrStatus;
  hiredAt: string;
};

export type WarehouseItem = {
  id: string;
  name: string;
  sku: string;
  qty: number;
  unit: string;
  minQty: number;
  location: string;
};

export type ClanRole = 'owner' | 'motivator' | 'member';

export type Clan = {
  id: string;
  name: string;
  inviteCode: string;
  ownerUid: string;
  ownerUsername: string;
  totalDistanceMeters: number;
  memberCount: number;
  createdAt: number;
  /** Эмодзи-логотип клана */
  emoji?: string;
};

export type ClanMember = {
  uid: string;
  username: string;
  role: ClanRole;
  distanceMeters: number;
  joinedAt: number;
  /** Expo push — доставка с телефона отправителя (бесплатно) */
  expoPushToken?: string;
  /** FCM push — доставка через сервер (Cloud Function) */
  fcmPushToken?: string;
  pushUpdatedAt?: number;
};

export type ClanMessage = {
  id: string;
  uid: string;
  username: string;
  text: string;
  createdAt: number;
  /** Время последнего редактирования (ms) — если есть, показываем «изменено» */
  editedAt?: number;
};

/** ── Анкета первичной регистрации (онбординг) ── */
export type Gender = 'male' | 'female' | 'other';
export type ActivityLevel = 'none' | 'sometimes' | 'light' | 'regular' | 'pro';
export type OnboardingGoal =
  | 'discipline'
  | 'habits'
  | 'weight_loss'
  | 'muscle'
  | 'health'
  | 'activity'
  | 'competition'
  | 'self_growth';
export type HealthCondition =
  | 'none'
  | 'heart'
  | 'pressure'
  | 'joints'
  | 'respiratory'
  | 'diabetes'
  | 'other';
export type RunVolume = 'none' | 'lt3' | '3-5' | '5-10' | 'gt10';
export type StepGoal = 5000 | 8000 | 10000 | 15000;

export type OnboardingProfile = {
  completed: boolean;
  /** Дата первого заполнения анкеты (ms) */
  completedAt?: number;
  /** Дата последнего редактирования (ms) */
  updatedAt?: number;
  name: string;
  age: number;
  gender: Gender;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goals: OnboardingGoal[];
  health: HealthCondition[];
  runVolume: RunVolume;
  stepGoal: StepGoal;
  consentAiInformational: boolean;
  consentConsultSpecialist: boolean;
};

export type UserData = {
  tasks: Task[];
  projects?: Project[];
  /** Анкета пользователя (онбординг / профиль здоровья) */
  onboarding?: OnboardingProfile;
  /** ID клана (спорт) */
  clanId?: string | null;
  /** Метка синхронизации общих проектов (ключи __it_team__ / __manager_team__) */
  teamSyncAt?: number;
  accountingEntries?: AccountingEntry[];
  hrEmployees?: HrEmployee[];
  warehouseItems?: WarehouseItem[];
  dailyDone: Record<string, string[]>;
  monthAchievements: Record<string, number[]>;
  dailySteps: Record<string, number>;
  lastVisit: string;
  /** Суммарная дистанция пробежек (GPS) — рейтинг и кланы */
  totalRunMeters?: number;
  totalRuns?: number;
  /** Суммарная дистанция велозаездов (GPS) — отдельный рейтинг */
  totalBikeMeters?: number;
  totalRides?: number;
};

export type RunnerStat = {
  uid: string;
  username: string;
  totalRunMeters: number;
  totalRuns: number;
  updatedAt: number;
};

export type CyclistStat = {
  uid: string;
  username: string;
  totalBikeMeters: number;
  totalRides: number;
  updatedAt: number;
};


export type Territory = {
  id: string;
  points: [number, number][];
  owner: string;
  capturedAt: string;
  lastDefendedAt: string;
  lengthMeters: number;
};
