import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Box,
  Heading,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Card,
  CardBody,
  Table,
  TableContainer,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
  Spinner,
  Center,
  Text,
  HStack,
  Icon,
  Avatar,
  VStack,
  IconButton,
  Alert,
  AlertIcon,
  Input,
  Button,
  ButtonGroup,
  Select,
} from '@chakra-ui/react';
import { FiUsers, FiClock, FiUserX, FiCheckCircle, FiRefreshCw, FiLogOut } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { dashboardAPI, BASE_URL } from '../services/api';
import { useSocket } from '../hooks/useSocket';
import AttendanceMap from '../components/AttendanceMap';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]); // Today's date in YYYY-MM-DD
  const [filterMode, setFilterMode] = useState('today'); // 'today', 'date', 'month', 'range'
  const isFetchingRef = useRef(false); // Prevent multiple simultaneous fetches
  const [stats, setStats] = useState({
    present: 0,
    late: 0,
    checkedOut: 0,
    absent: 0,
    total: 0,
  });
  const [employees, setEmployees] = useState({
    present: [],
    late: [],
    checkedOut: [],
    absent: [],
  });
  const [mapData, setMapData] = useState({
    headquarters: null,
    checkIns: []
  });

  // Update current time every second (using Jordan timezone)
  useEffect(() => {
    const updateTime = () => {
      // Get current time in Jordan timezone
      const now = new Date();
      const jordanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Amman' }));
      setCurrentTime(jordanTime);
    };
    
    updateTime(); // Update immediately
    const timeInterval = setInterval(updateTime, 1000);
    return () => clearInterval(timeInterval);
  }, []);

  const fetchDashboardData = useCallback(async (showLoading = true) => {
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current) {
      console.log('⏸️ Fetch already in progress, skipping...');
      return;
    }

    isFetchingRef.current = true;
    
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      
      // Build date parameters based on filter mode
      let dateParams = {};
      const today = new Date();
      
      if (filterMode === 'today') {
        // No params needed - backend defaults to today
        dateParams = {};
      } else if (filterMode === 'date') {
        dateParams = { date: selectedDate };
      } else if (filterMode === 'thisMonth') {
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        dateParams = {
          startDate: firstDay.toISOString().split('T')[0],
          endDate: lastDay.toISOString().split('T')[0]
        };
      } else if (filterMode === 'lastMonth') {
        const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
        dateParams = {
          startDate: firstDay.toISOString().split('T')[0],
          endDate: lastDay.toISOString().split('T')[0]
        };
      }
      
      // Fetch real data from backend
      const data = await dashboardAPI.getTodayAttendance(dateParams);
      
      if (data.stats && data.employees) {
        setStats(data.stats);
        setEmployees(data.employees);
      }
      
      if (data.mapData) {
        setMapData(data.mapData);
      }
      
      if (showLoading) {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      // Show user-friendly error message
      const errorMessage = error.message || 'حدث خطأ في جلب البيانات';
      setError(errorMessage.includes('Cannot connect') 
        ? 'لا يمكن الاتصال بالخادم. يرجى التأكد من تشغيل الخادم.' 
        : errorMessage);
      // Set empty state on error
      setStats({
        present: 0,
        late: 0,
        checkedOut: 0,
        absent: 0,
        total: 0,
      });
      setEmployees({
        present: [],
        late: [],
        checkedOut: [],
        absent: [],
      });
      if (showLoading) {
        setLoading(false);
      }
    } finally {
      isFetchingRef.current = false;
    }
  }, [filterMode, selectedDate]); // Include filter dependencies

  // Socket.io real-time event handlers (using useCallback to prevent recreation)
  const handleCheckIn = useCallback((data) => {
    console.log('📡 Real-time check-in received:', data);
    // Only refresh if viewing today's data (real-time updates only for current day)
    if (filterMode === 'today') {
      fetchDashboardData(false);
    }
  }, [fetchDashboardData, filterMode]);

  const handleCheckOut = useCallback((data) => {
    console.log('📡 Real-time check-out received:', data);
    // Only refresh if viewing today's data (real-time updates only for current day)
    if (filterMode === 'today') {
      fetchDashboardData(false);
    }
  }, [fetchDashboardData, filterMode]);

  // Memoize event handlers object to prevent recreation
  const socketEventHandlers = useMemo(() => ({
    'attendance:checkin': handleCheckIn,
    'attendance:checkout': handleCheckOut,
  }), [handleCheckIn, handleCheckOut]);

  // Connect to Socket.io for real-time updates
  useSocket(
    () => {
      console.log('✅ Connected to Socket.io for real-time updates');
      setSocketConnected(true);
    },
    () => {
      console.log('❌ Disconnected from Socket.io');
      setSocketConnected(false);
    },
    socketEventHandlers
  );

  // Fetch data when filter changes
  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]); // fetchDashboardData already depends on filterMode and selectedDate


  const StatCard = ({ title, value, icon, color, helpText }) => (
    <Card>
      <CardBody>
        <Stat>
          <HStack justify="space-between" mb={2}>
            <StatLabel fontSize="md" color="gray.600">{title}</StatLabel>
            <Icon as={icon} boxSize={8} color={color} />
          </HStack>
          <StatNumber fontSize="4xl" fontWeight="bold" color={color}>
            {value}
          </StatNumber>
          {helpText && (
            <StatHelpText color="gray.500">{helpText}</StatHelpText>
          )}
        </Stat>
      </CardBody>
    </Card>
  );

  if (loading) {
    return (
      <MainLayout>
        <Center h="50vh">
          <Spinner size="xl" color="blue.500" />
        </Center>
      </MainLayout>
    );
  }

  // Format date for display (using Jordan timezone)
  const formatDate = (dateString = null) => {
    let date;
    if (dateString) {
      // If date string provided, use it
      date = new Date(dateString);
    } else {
      // Otherwise use current date in Jordan timezone
      date = new Date();
    }
    
    // Format using Jordan timezone (Asia/Amman)
    return date.toLocaleDateString('ar-JO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Amman'
    });
  };

  const formatTime = (date) => {
    // Use Jordan timezone (Asia/Amman) for accurate local time
    return date.toLocaleTimeString('ar-JO', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Amman'
    });
  };

  return (
    <MainLayout>
      <Box w="100%" maxW="100%" overflowX="hidden" boxSizing="border-box">
        <HStack 
          justify="space-between" 
          mb={4} 
          flexWrap="wrap" 
          spacing={{ base: 2, md: 4 }}
          pl={{ base: 12, md: 0 }}
        >
          <VStack align="start" spacing={1} flex={{ base: "1 1 100%", md: "0 1 auto" }}>
            <HStack spacing={{ base: 2, md: 4 }} flexWrap="wrap">
              <Heading 
                color="gray.700"
                fontSize={{ base: "xl", md: "2xl", lg: "3xl" }}
              >
                لوحة الحضور
              </Heading>
              {socketConnected && filterMode === 'today' && (
                <Badge 
                  colorScheme="green" 
                  fontSize={{ base: "2xs", md: "xs" }} 
                  px={{ base: 1.5, md: 2 }} 
                  py={{ base: 0.5, md: 1 }} 
                  borderRadius="md"
                >
                  🔴 مباشر
                </Badge>
              )}
            </HStack>
            <Text fontSize={{ base: "xs", md: "sm" }} color="gray.500">
              {filterMode === 'today' && 'حضور اليوم'}
              {filterMode === 'date' && `حضور ${formatDate(selectedDate)}`}
              {filterMode === 'thisMonth' && 'حضور هذا الشهر'}
              {filterMode === 'lastMonth' && 'حضور الشهر الماضي'}
            </Text>
          </VStack>
          <HStack 
            spacing={{ base: 2, md: 3 }} 
            flex={{ base: "1 1 100%", md: "0 1 auto" }} 
            justify={{ base: "flex-end", md: "flex-end" }}
            w={{ base: "100%", md: "auto" }}
          >
            <VStack align="end" spacing={0}>
              <Text fontSize={{ base: "xs", md: "sm" }} color="gray.600" fontWeight="medium">
                {formatTime(currentTime)}
              </Text>
              <Text fontSize={{ base: "2xs", md: "xs" }} color="gray.500">
                {formatDate()}
              </Text>
            </VStack>
            <IconButton
              icon={<FiRefreshCw />}
              aria-label="تحديث"
              onClick={() => fetchDashboardData(true)}
              isLoading={loading}
              colorScheme="blue"
              variant="outline"
              size={{ base: "sm", md: "md" }}
            />
          </HStack>
        </HStack>

        {/* Date Filter Section */}
        <Card mb={6} ml={{ base: -2, md: 0 }}>
          <CardBody>
            <HStack spacing={4} flexWrap="wrap" justify="space-between">
              <HStack spacing={4} flexWrap="wrap">
                <Text fontWeight="medium" color="gray.700">فلترة حسب التاريخ:</Text>
                <ButtonGroup size="sm" isAttached variant="outline">
                  <Button
                    colorScheme={filterMode === 'today' ? 'blue' : 'gray'}
                    onClick={() => {
                      setFilterMode('today');
                      setSelectedDate(new Date().toISOString().split('T')[0]);
                    }}
                  >
                    اليوم
                  </Button>
                  <Button
                    colorScheme={filterMode === 'thisMonth' ? 'blue' : 'gray'}
                    onClick={() => setFilterMode('thisMonth')}
                  >
                    هذا الشهر
                  </Button>
                  <Button
                    colorScheme={filterMode === 'lastMonth' ? 'blue' : 'gray'}
                    onClick={() => setFilterMode('lastMonth')}
                  >
                    الشهر الماضي
                  </Button>
                </ButtonGroup>
                <HStack spacing={2}>
                  <Text fontSize="sm" color="gray.600">أو اختر تاريخ:</Text>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => {
                      setSelectedDate(e.target.value);
                      setFilterMode('date');
                    }}
                    size="sm"
                    width="150px"
                  />
                </HStack>
              </HStack>
              <Badge colorScheme="blue" fontSize="sm" px={3} py={1} borderRadius="md">
                ساعات العمل: 09:00 صباحاً - 05:00 مساءً (8 ساعات)
              </Badge>
            </HStack>
          </CardBody>
        </Card>
        
        {error && (
          <Alert status="error" mb={4} borderRadius="md">
            <AlertIcon />
            {error}
          </Alert>
        )}
        
        {/* Stats Cards */}
        <SimpleGrid columns={{ base: 1, md: 2, lg: 5 }} spacing={6} mb={8}>
          <StatCard
            title="الحاضرون"
            value={stats.present}
            icon={FiCheckCircle}
            color="green.500"
            helpText={`من ${stats.total} موظف`}
          />
          <StatCard
            title="المتأخرون"
            value={stats.late}
            icon={FiClock}
            color="orange.500"
            helpText="اليوم"
          />
          <StatCard
            title="المنصرفون"
            value={stats.checkedOut}
            icon={FiLogOut}
            color="purple.500"
            helpText="انصرفوا اليوم"
          />
          <StatCard
            title="الغائبون"
            value={stats.absent}
            icon={FiUserX}
            color="red.500"
            helpText="لم يسجلوا حتى الآن"
          />
          <StatCard
            title="إجمالي الموظفين"
            value={stats.total}
            icon={FiUsers}
            color="blue.500"
            helpText="نشط"
          />
        </SimpleGrid>

        {/* Employees Tables */}
        <Card>
          <CardBody>
            <Tabs variant="enclosed" colorScheme="blue">
              <TabList 
                flexWrap="wrap"
                overflowX="auto"
                css={{
                  '&::-webkit-scrollbar': {
                    display: 'none'
                  },
                  '-ms-overflow-style': 'none',
                  'scrollbar-width': 'none'
                }}
              >
                <Tab 
                  fontSize={{ base: "xs", md: "sm" }}
                  px={{ base: 2, md: 4 }}
                  py={{ base: 2, md: 3 }}
                  whiteSpace="nowrap"
                >
                  الحاضرون ({stats.present})
                </Tab>
                <Tab 
                  fontSize={{ base: "xs", md: "sm" }}
                  px={{ base: 2, md: 4 }}
                  py={{ base: 2, md: 3 }}
                  whiteSpace="nowrap"
                >
                  المتأخرون ({stats.late})
                </Tab>
                <Tab 
                  fontSize={{ base: "xs", md: "sm" }}
                  px={{ base: 2, md: 4 }}
                  py={{ base: 2, md: 3 }}
                  whiteSpace="nowrap"
                >
                  المنصرفون ({stats.checkedOut})
                </Tab>
                <Tab 
                  fontSize={{ base: "xs", md: "sm" }}
                  px={{ base: 2, md: 4 }}
                  py={{ base: 2, md: 3 }}
                  whiteSpace="nowrap"
                >
                  الغائبون ({stats.absent})
                </Tab>
              </TabList>

              <TabPanels>
                {/* Present Employees */}
                <TabPanel>
                  {employees.present.length === 0 ? (
                    <Center py={10}>
                      <Text color="gray.500">لا يوجد موظفين حاضرين في الوقت المحدد</Text>
                    </Center>
                  ) : (
                    <TableContainer overflowX="auto" maxW="100%">
                      <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>الموظف</Th>
                          <Th>رقم الموظف</Th>
                          <Th>وقت الحضور</Th>
                          <Th>وقت الانصراف</Th>
                          <Th>الموقع</Th>
                          <Th>الحالة</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {employees.present.map((emp) => (
                          <Tr key={emp.id}>
                            <Td>
                              <HStack spacing={3}>
                                <Avatar 
                                  size="sm" 
                                  name={emp.name} 
                                  src={emp.profileImage ? `${BASE_URL}${emp.profileImage}` : undefined}
                                />
                                <VStack align="start" spacing={0}>
                                  <Text fontWeight="medium">{emp.name}</Text>
                                  {emp.department && (
                                    <Text fontSize="xs" color="gray.500">{emp.department}</Text>
                                  )}
                                </VStack>
                              </HStack>
                            </Td>
                            <Td color="gray.600">{emp.employeeNumber}</Td>
                            <Td>{emp.checkInTime}</Td>
                            <Td>
                              {emp.checkOutTime ? (
                                <Badge colorScheme="blue">{emp.checkOutTime}</Badge>
                              ) : (
                                <Badge colorScheme="green" variant="outline">في العمل</Badge>
                              )}
                            </Td>
                            <Td fontSize="sm" color="gray.600">{emp.location}</Td>
                            <Td>
                              <Badge colorScheme="green">في الوقت</Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    </TableContainer>
                  )}
                </TabPanel>

                {/* Late Employees */}
                <TabPanel>
                  {employees.late.length === 0 ? (
                    <Center py={10}>
                      <Text color="gray.500">لا يوجد موظفين متأخرين</Text>
                    </Center>
                  ) : (
                    <TableContainer overflowX="auto" maxW="100%">
                      <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>الموظف</Th>
                          <Th>رقم الموظف</Th>
                          <Th>وقت الحضور</Th>
                          <Th>التأخير</Th>
                          <Th>وقت الانصراف</Th>
                          <Th>الموقع</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {employees.late.map((emp) => (
                          <Tr key={emp.id}>
                            <Td>
                              <HStack spacing={3}>
                                <Avatar 
                                  size="sm" 
                                  name={emp.name} 
                                  src={emp.profileImage ? `${BASE_URL}${emp.profileImage}` : undefined}
                                />
                                <VStack align="start" spacing={0}>
                                  <Text fontWeight="medium">{emp.name}</Text>
                                  {emp.department && (
                                    <Text fontSize="xs" color="gray.500">{emp.department}</Text>
                                  )}
                                </VStack>
                              </HStack>
                            </Td>
                            <Td color="gray.600">{emp.employeeNumber}</Td>
                            <Td>{emp.checkInTime}</Td>
                            <Td>
                              <Badge colorScheme="orange">{emp.lateMinutes} دقيقة</Badge>
                            </Td>
                            <Td>
                              {emp.checkOutTime ? (
                                <Badge colorScheme="blue">{emp.checkOutTime}</Badge>
                              ) : (
                                <Badge colorScheme="green" variant="outline">في العمل</Badge>
                              )}
                            </Td>
                            <Td fontSize="sm" color="gray.600">{emp.location}</Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    </TableContainer>
                  )}
                </TabPanel>

                {/* Checked Out Employees */}
                <TabPanel>
                  {employees.checkedOut.length === 0 ? (
                    <Center py={10}>
                      <Text color="gray.500">لا يوجد موظفين منصرفين حتى الآن</Text>
                    </Center>
                  ) : (
                    <TableContainer overflowX="auto" maxW="100%">
                      <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>الموظف</Th>
                          <Th>رقم الموظف</Th>
                          <Th>وقت الحضور</Th>
                          <Th>وقت الانصراف</Th>
                          <Th>ساعات العمل</Th>
                          <Th>وقت إضافي</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {employees.checkedOut.map((emp) => (
                          <Tr key={emp.id}>
                            <Td>
                              <HStack spacing={3}>
                                <Avatar 
                                  size="sm" 
                                  name={emp.name} 
                                  src={emp.profileImage ? `${BASE_URL}${emp.profileImage}` : undefined}
                                />
                                <VStack align="start" spacing={0}>
                                  <Text fontWeight="medium">{emp.name}</Text>
                                  {emp.department && (
                                    <Text fontSize="xs" color="gray.500">{emp.department}</Text>
                                  )}
                                </VStack>
                              </HStack>
                            </Td>
                            <Td color="gray.600">{emp.employeeNumber}</Td>
                            <Td>{emp.checkInTime}</Td>
                            <Td>
                              <Badge colorScheme="blue">{emp.checkOutTime}</Badge>
                            </Td>
                            <Td>
                              <Badge colorScheme="green">{emp.workingHours} ساعة</Badge>
                            </Td>
                            <Td>
                              {emp.overtime && emp.overtime !== '0:00' ? (
                                <Badge colorScheme="purple">{emp.overtime} ساعة</Badge>
                              ) : (
                                <Text color="gray.400">-</Text>
                              )}
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    </TableContainer>
                  )}
                </TabPanel>

                {/* Absent Employees */}
                <TabPanel>
                  {employees.absent.length === 0 ? (
                    <Center py={10}>
                      <Text color="gray.500">جميع الموظفين حاضرون! 🎉</Text>
                    </Center>
                  ) : (
                    <TableContainer overflowX="auto" maxW="100%">
                      <Table variant="simple">
                      <Thead>
                        <Tr>
                          <Th>اسم الموظف</Th>
                          <Th>رقم الموظف</Th>
                          <Th>وقت الحضور المتوقع</Th>
                          <Th>وقت الانصراف المتوقع</Th>
                          <Th>الحالة</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {employees.absent.map((emp) => (
                          <Tr key={emp.id}>
                            <Td fontWeight="medium">{emp.name}</Td>
                            <Td color="gray.600">{emp.employeeNumber}</Td>
                            <Td>{emp.expectedTime || '09:00 صباحاً'}</Td>
                            <Td color="gray.600">{emp.expectedCheckOut || '05:00 مساءً'}</Td>
                            <Td>
                              <Badge colorScheme="red">غائب</Badge>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    </TableContainer>
                  )}
                </TabPanel>
              </TabPanels>
            </Tabs>
          </CardBody>
        </Card>

        {/* Map Component */}
        <Card mt={8}>
          <CardBody>
            <HStack justify="space-between" mb={4}>
              <Heading size="md">موقع المقر الرئيسي</Heading>
              <HStack spacing={2}>
                <Box>
                  <svg width="24" height="32" viewBox="0 0 40 54" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 0C8.954 0 0 8.954 0 20c0 14.5 20 34 20 34s20-19.5 20-34c0-11.046-8.954-20-20-20z" fill="#EA4335"/>
                    <circle cx="20" cy="20" r="8" fill="white"/>
                  </svg>
                </Box>
                <Text color="gray.600" fontSize="sm">المقر الرئيسي</Text>
              </HStack>
            </HStack>
            {mapData.headquarters ? (
              <>
                <AttendanceMap
                  headquarters={mapData.headquarters}
                  checkIns={mapData.checkIns || []}
                />
                
                {/* Employee Check-in/out List */}
                {mapData.checkIns && mapData.checkIns.length > 0 && (
                  <Box mt={6}>
                    <Heading size="sm" mb={4} color="gray.700">
                      مواقع حضور وانصراف الموظفين ({mapData.checkIns.reduce((acc, loc) => acc + loc.employees.length, 0)} موظف)
                    </Heading>
                    <VStack spacing={3} align="stretch">
                      {mapData.checkIns.map((checkIn, idx) => {
                        const distanceKm = (checkIn.distance / 1000).toFixed(2);
                        const distanceText = checkIn.distance < 1000 
                          ? `${checkIn.distance} متر` 
                          : `${distanceKm} كم`;
                        
                        return checkIn.employees.map((emp, empIdx) => (
                          <Box
                            key={`${idx}-${empIdx}`}
                            p={4}
                            bg="white"
                            borderRadius="lg"
                            border="1px solid"
                            borderColor="gray.200"
                            boxShadow="sm"
                            _hover={{ boxShadow: 'md', borderColor: 'blue.300' }}
                            transition="all 0.2s"
                          >
                            <HStack justify="space-between" align="start">
                              <VStack align="start" spacing={2} flex={1}>
                                <HStack spacing={3}>
                                  <Text fontSize="lg" fontWeight="bold" color="gray.800">
                                    {emp.name}
                                  </Text>
                                  <Badge colorScheme="gray" fontSize="xs">
                                    {emp.employeeNumber}
                                  </Badge>
                                </HStack>
                                
                                <HStack spacing={2} fontSize="sm" color="gray.600">
                                  <Box>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                                    </svg>
                                  </Box>
                                  <Text>{checkIn.address}</Text>
                                </HStack>
                                
                                <HStack spacing={4} fontSize="sm">
                                  <HStack spacing={1}>
                                    <Text color="green.600" fontWeight="medium">✓ حضور:</Text>
                                    <Text color="gray.700" fontWeight="bold">{emp.checkInTime}</Text>
                                  </HStack>
                                  
                                  {emp.checkOutTime ? (
                                    <HStack spacing={1}>
                                      <Text color="orange.600" fontWeight="medium">← انصراف:</Text>
                                      <Text color="gray.700" fontWeight="bold">{emp.checkOutTime}</Text>
                                    </HStack>
                                  ) : (
                                    <Badge colorScheme="blue" fontSize="xs">
                                      لا يزال في العمل
                                    </Badge>
                                  )}
                                </HStack>
                              </VStack>
                              
                              <VStack align="end" spacing={1}>
                                <Badge 
                                  colorScheme={checkIn.distance < 100 ? 'green' : checkIn.distance < 1000 ? 'blue' : 'orange'}
                                  fontSize="sm"
                                  px={3}
                                  py={1}
                                  borderRadius="full"
                                >
                                  📏 {distanceText}
                                </Badge>
                                <Text fontSize="xs" color="gray.500">من المقر</Text>
                              </VStack>
                            </HStack>
                          </Box>
                        ));
                      })}
                    </VStack>
                  </Box>
                )}
              </>
            ) : (
              <Center h="400px" bg="gray.100" borderRadius="md">
                <Text color="gray.500">جاري تحميل الخريطة...</Text>
              </Center>
            )}
          </CardBody>
        </Card>
      </Box>
    </MainLayout>
  );
};

export default Dashboard;




