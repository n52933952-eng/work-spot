import { Box } from '@chakra-ui/react';
import Sidebar from './Sidebar';

const MainLayout = ({ children }) => {
  return (
    <Box minH="100vh" bg="gray.50">
      <Sidebar />
      <Box ml="250px" p={8}>
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;





