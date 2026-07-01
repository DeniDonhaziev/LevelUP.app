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
    <View
      style={[
        styles.row,
        { borderColor: palette.border, backgroundColor: palette.cardBg },
        done && { opacity: 0.7 },
      ]}>
      <Pressable
        onPress={() => onToggle(taskId)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done }}>
        {done ? (
          <View style={[styles.checkboxDone, { backgroundColor: palette.accentDone }]}>
            <Ionicons name="checkmark" size={15} color="#0A0A0B" />
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
        style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.5 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel={`Удалить ${name}`}>
        <Ionicons name="trash-outline" size={18} color={palette.muted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
  },
  checkboxDone: {
    width: 24,
    height: 24,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameWrap: { flex: 1 },
  name: { fontSize: 15, fontFamily: 'Inter_500Medium' },
  nameDone: { textDecorationLine: 'line-through', color: '#8A8A8A' },
  deleteBtn: { padding: 4 },
});
