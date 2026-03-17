import { Route, Routes } from "react-router-dom";
import { HomePage } from "@/screens/HomePage";
import { RoomScreen } from "@/screens/RoomScreen";

const App = () => (
  <Routes>
    <Route path="/" element={<HomePage />} />
    <Route path="/room/:roomCode" element={<RoomScreen />} />
  </Routes>
);

export default App;
