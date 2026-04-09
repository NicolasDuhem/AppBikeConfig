import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import { BikeBuilderPage } from "./routes/BikeBuilderPage";
import { CataloguePage } from "./routes/CataloguePage";
import { ConfigurationVariantsPage } from "./routes/ConfigurationVariantsPage";
import { CategoryNavigationPage } from "./routes/CategoryNavigationPage";
import { HomePage } from "./routes/HomePage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/catalogue/categories" element={<CategoryNavigationPage />} />
        <Route path="/catalogue" element={<Navigate to="/catalogue/categories" replace />} />
        <Route path="/catalogue/:categorySlug" element={<CataloguePage />} />
        <Route path="/variants/:bikeTypeId" element={<ConfigurationVariantsPage />} />
        <Route path="/configure" element={<BikeBuilderPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
