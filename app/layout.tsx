// import { Children } from "react";
import "./global.css";
export const metadata = {
  title: "companygpt",
  description: "the place to go for all your big informatique question!",
};

const RootLayout = ({ children }) => {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
};
export default RootLayout;
