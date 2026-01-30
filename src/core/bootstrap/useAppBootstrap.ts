import { useAuthUser } from "../auth/useAuthUser";
import { useLoadUserAndOrg } from "../org/useOrg";

export function useAppBootstrap() {
  const { authUser, authLoading } = useAuthUser();
  useLoadUserAndOrg(authUser?.uid);

  return { authUser, authLoading };
}



