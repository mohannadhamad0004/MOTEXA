import * as Haptics from "expo-haptics";

// Outcomes only: request sent, provider accept, admin approve/reject, failed submit. Never loads, reveals or toggles.
export const hapticSuccess = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
export const hapticError = () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
