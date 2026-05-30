import { forwardRef } from 'react';
import {
  ScrollView,
  type ScrollViewProps,
  useWindowDimensions,
} from 'react-native';

import { screenLayout, isDesktopWebLayout } from '@/lib/screenLayout';

import { ScreenBackground } from './ScreenBackground';

type Props = ScrollViewProps & {
  children: React.ReactNode;
  withMobileGrowFix?: boolean;
};

export const ScreenScroll = forwardRef<ScrollView, Props>(function ScreenScroll(
  { children, contentContainerStyle, withMobileGrowFix = true, ...rest },
  ref
) {
  const { width } = useWindowDimensions();
  const desktop = isDesktopWebLayout(width);

  return (
    <ScreenBackground>
      <ScrollView
        ref={ref}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          screenLayout.scroll,
          withMobileGrowFix && !desktop && screenLayout.scrollMobile,
          desktop && screenLayout.scrollDesktop,
          contentContainerStyle,
        ]}
        {...rest}>
        {children}
      </ScrollView>
    </ScreenBackground>
  );
});
