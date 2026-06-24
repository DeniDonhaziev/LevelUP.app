import React, { useEffect } from 'react';
import {
  Image,
  Platform,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  BottomTabBarHeightCallbackContext,
  type BottomTabBarProps,
} from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LogoutButton } from '@/components/LogoutButton';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useAppTopic } from '@/hooks/useAppTopic';
import { isTabVisibleForTopic } from '@/lib/tabVisibility';
import { WebTheme } from '@/lib/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

function filterTabRoutes(routes: BottomTabBarProps['state']['routes']) {
  return routes.filter((route) => isTabVisibleForTopic(route.name));
}

function isTabFocused(state: BottomTabBarProps['state'], routeName: string) {
  const current = state.routes[state.index];
  return current?.name === routeName;
}

function MobileTabBar(
  props: BottomTabBarProps & {
    tabActive: string;
    palette: (typeof Colors)['dark'] | (typeof Colors)['light'];
  }
) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 8);
  const onHeightChange = React.useContext(BottomTabBarHeightCallbackContext);
  const tabActive = props.tabActive;
  const visibleRoutes = filterTabRoutes(props.state.routes);
  const c = props.palette;

  return (
    <View
      pointerEvents="box-none"
      onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        paddingHorizontal: 14,
        paddingBottom: bottomPad + 8,
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: 20,
          borderWidth: 1,
          borderColor: c.border,
          backgroundColor: c.tabBar,
          overflow: 'hidden',
        }}>
        {visibleRoutes.map((route) => {
          const { options } = props.descriptors[route.key];
          const label =
            typeof options.tabBarLabel === 'string'
              ? options.tabBarLabel
              : typeof options.title === 'string'
                ? options.title
                : route.name;
          const isFocused = isTabFocused(props.state, route.name);

          const onPress = () => {
            const event = props.navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              props.navigation.navigate(route.name);
            }
          };

          const tint = isFocused ? c.accent : c.tabIconDefault;

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={() =>
                props.navigation.emit({ type: 'tabLongPress', target: route.key })
              }
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 62,
                opacity: pressed ? 0.7 : 1,
              })}>
              {isFocused ? (
                <View
                  style={{
                    width: 22,
                    height: 3,
                    borderRadius: 2,
                    backgroundColor: c.accent,
                    marginBottom: 6,
                  }}
                />
              ) : (
                <View style={{ height: 9 }} />
              )}
              {options.tabBarIcon?.({ focused: isFocused, color: tint, size: 24 })}
              <Text
                numberOfLines={1}
                style={{
                  marginTop: 4,
                  fontSize: 10,
                  fontFamily: 'Inter_500Medium',
                  color: tint,
                }}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function TabIconPair(filled: IconName, outline: IconName, color: string, focused: boolean) {
  return <Ionicons name={focused ? filled : outline} size={22} color={color} />;
}

function HeaderLogo({
  textColor,
  label,
  palette,
}: {
  textColor: string;
  label: string;
  palette: (typeof Colors)['dark'] | (typeof Colors)['light'];
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 999, backgroundColor: palette.card, borderWidth: 1, borderColor: palette.border }}>
      <Image source={require('../../assets/images/app-icon.png')} style={{ width: 20, height: 20, borderRadius: 6 }} resizeMode="contain" />
      <Text style={{ color: textColor, fontFamily: 'Inter_700Bold', fontSize: 16 }}>{label}</Text>
    </View>
  );
}

function DesktopSideBar({
  props,
  palette,
  tabActive,
}: {
  props: BottomTabBarProps;
  palette: (typeof Colors)['dark'] | (typeof Colors)['light'];
  tabActive: string;
}) {
  const iconByRoute: Record<string, IconName> = {
    index: 'home',
    stats: 'trophy',
    run: 'git-branch',
    clans: 'shield',
    activity: 'flame',
    ai: 'sparkles',
    profile: 'person',
  };
  return (
    <View style={{ position: 'absolute', left: 14, top: 82, bottom: 18, width: 58, borderRadius: 22, backgroundColor: palette.cardElevated, paddingVertical: 10, alignItems: 'center', gap: 10, ...WebTheme.shadowSoft }}>
      {filterTabRoutes(props.state.routes).map((route) => {
        const focused = isTabFocused(props.state, route.name);
        const icon = iconByRoute[route.name] ?? 'ellipse';
        return (
          <Pressable
            key={route.key}
            onPress={() => props.navigation.navigate(route.name)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: focused ? palette.accent : palette.border,
              backgroundColor: focused ? palette.accentSoft : palette.card,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name={icon} size={18} color={focused ? palette.accent : palette.text} />
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= 1100;
  const colorScheme = useColorScheme() ?? 'dark';
  const palette = Colors[colorScheme];
  const topic = useAppTopic();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 10);
  useEffect(() => {
    const removed = ['projects', 'accounting', 'hr', 'warehouse', 'activity'] as const;
    for (const name of removed) {
      if (pathname.includes(`/${name}`)) {
        router.replace('/(tabs)');
        return;
      }
    }
  }, [pathname, router]);

  const mobileTabBarHeight = 92 + bottomPad;

  return (
    <View style={{ flex: 1, backgroundColor: palette.backgroundAlt }}>
      <Tabs
        tabBar={(props) =>
          isDesktopWeb ? (
            <DesktopSideBar
              props={props}
              palette={palette}
              tabActive={topic.tabActive}
            />
          ) : (
            <MobileTabBar {...props} tabActive={topic.tabActive} palette={palette} />
          )
        }
        screenOptions={{
          tabBarActiveTintColor: isDesktopWeb ? topic.tabActive : topic.tabActive,
          tabBarInactiveTintColor: palette.tabIconDefault,
          sceneStyle: isDesktopWeb
            ? { paddingLeft: 86, backgroundColor: palette.backgroundAlt }
            : { backgroundColor: palette.backgroundAlt },
          tabBarStyle: isDesktopWeb
          ? {
              backgroundColor: palette.tabBar,
              borderTopColor: palette.border,
              borderTopWidth: 1,
              borderLeftWidth: 0,
              borderRightWidth: 0,
              borderTopLeftRadius: 28,
              borderTopRightRadius: 28,
              marginHorizontal: 8,
              marginBottom: Platform.OS === 'web' ? 0 : 8,
              height: WebTheme.navHeight + bottomPad,
              paddingBottom: bottomPad + 2,
              paddingTop: 8,
              paddingHorizontal: 4,
              shadowColor: '#1C1C1E',
              shadowOffset: { width: 0, height: -8 },
              shadowOpacity: 0.08,
              shadowRadius: 10,
              elevation: 8,
              position: 'relative',
            }
          : {
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'transparent',
              borderTopWidth: 0,
              elevation: 0,
              height: 0,
            },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: 'Inter_500Medium',
          marginTop: 2,
        },
        tabBarItemStyle: { paddingVertical: 4, borderRadius: 14 },
        headerStyle: {
          backgroundColor: palette.background,
          borderBottomWidth: 0,
          shadowOpacity: 0,
          shadowRadius: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          fontFamily: 'Inter_700Bold',
          fontSize: 20,
          color: palette.text,
        },
        headerTintColor: palette.text,
        headerShown: useClientOnlyValue(false, true),
        headerRight: () => <LogoutButton />,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Главная',
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color, focused }) => TabIconPair('home', 'home-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="stats"
        options={{
          title: 'Рейтинг',
          tabBarLabel: 'Рейтинг',
          tabBarIcon: ({ color, focused }) => TabIconPair('trophy', 'trophy-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="run"
        options={{
          title: 'Бег',
          tabBarLabel: 'Бег',
          tabBarIcon: ({ color, focused }) => TabIconPair('git-branch', 'git-branch-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="clans"
        options={{
          title: 'Кланы',
          tabBarLabel: 'Кланы',
          tabBarIcon: ({ color, focused }) => TabIconPair('shield', 'shield-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="activity"
        options={{
          href: null,
          title: 'Прогресс',
          tabBarLabel: 'Прогресс',
          tabBarIcon: ({ color, focused }) => TabIconPair('flame', 'flame-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarLabel: 'AI',
          tabBarIcon: ({ color, focused }) => TabIconPair('sparkles', 'sparkles-outline', color, focused),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color, focused }) => TabIconPair('person', 'person-outline', color, focused),
          headerTitle: () => <HeaderLogo textColor={palette.text} label="Профиль" palette={palette} />,
        }}
      />
    </Tabs>
    </View>
  );
}
