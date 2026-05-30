import { Pressable, Text, View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { confirmDelete } from '@/lib/confirmAction';

type Palette = {
  text: string;
  muted: string;
  border: string;
  cardBg: string;
  accentDone: string;
};

type Props = {
  taskId: string;
  name: string;
  done: boolean;
  palette: Palette;
  onToggle: (taskId: string) => void;
  onDelete: (taskId: string) => void;
};

export function ActivityTaskRow({ taskId, name, done, palette, onToggle, onDelete }: Props) {
  return (
    <View style={[styles.row, { borderColor: palette.border, backgroundColor: palette.cardBg }]}>
      <Pressable
        onPress={() => onToggle(taskId)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}>
        {done ? (
          <View style={[styles.checkboxDone, { backgroundColor: palette.accentDone + '14', borderColor: palette.accentDone }]}>
            <Ionicons name="checkmark" size={16} color={palette.accentDone} />
          </View>
        ) : (
          <View style={[styles.checkbox, { borderColor: palette.border }]} />
        )}
      </Pressable>
      <Pressable onPress={() => onToggle(taskId)} style={styles.nameWrap}>
        <Text style={[styles.name, { color: palette.text }, done && styles.nameDone]} numberOfLines={2}>
          {name}
        </Text>
      </Pressable>
      <Pressable
        onPress={() =>
          confirmDelete('Удалить активность?', name, () => {
            onDelete(taskId);
          })
        }
        hitSlop={10}
        style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`Удалить ${name}`}>
        <Ionicons name="trash-outline" size={18} color="#111111" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 12,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
  },
  checkboxDone: {
    width: 28,
    height: 28,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: { flex: 1 },
  name: { fontSize: 16, fontFamily: 'Inter_600SemiBold', letterSpacing: -0.2 },
  nameDone: { textDecorationLine: 'line-through', opacity: 0.45 },
  deleteBtn: { padding: 6 },
});
