import { Navigate, RouteSectionProps } from "@solidjs/router";

import { isAuthenticated } from "../services/userApi";
import Layout from "./Layout";

const ProtectedLayout = (props: RouteSectionProps) => {
  return (
    <>
      {isAuthenticated() ?
        <Layout {...props} />
      : <Navigate href="/login" />}
    </>
  );
};

export default ProtectedLayout;
