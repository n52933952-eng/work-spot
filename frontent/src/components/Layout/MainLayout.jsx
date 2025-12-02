import { Box, useBreakpointValue } from '@chakra-ui/react';
import Sidebar from './Sidebar';
import { useState } from 'react';

const MainLayout = ({ children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });
  const contentMargin = useBreakpointValue({ base: '0', md: '250px' });
  const contentPadding = useBreakpointValue({ base: 4, md: 8 });

  return (
    <Box minH="100vh" bg="gray.50" w="100%" overflowX="hidden" position="relative">
      <Sidebar 
        isMobile={isMobile} 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />
      <Box 
        ml={contentMargin} 
        p={contentPadding}
        w={{ base: "100%", md: "calc(100% - 250px)" }}
        maxW="100%"
        transition="margin-left 0.3s ease, width 0.3s ease"
        minH="100vh"
        overflowX="hidden"
        boxSizing="border-box"
        position="relative"
      >
        {children}
      </Box>
    </Box>
  );
};

export default MainLayout;





