import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Heading,
  Card,
  CardBody,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Badge,
  Avatar,
  HStack,
  VStack,
  Text,
  Spinner,
  Center,
  SimpleGrid,
  Stat,
  StatLabel,
  StatNumber,
  Icon,
  useToast,
} from '@chakra-ui/react';
import { FiAward, FiTrendingUp, FiStar } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import useSocket from '../hooks/useSocket';

const Points = () => {
  const [loading, setLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState([]);
  const [recentCheckins, setRecentCheckins] = useState([]);
  const toast = useToast();

  const persistLeaderboard = useCallback((data) => {
    try {
      localStorage.setItem('pointsLeaderboard', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist leaderboard:', error);
    }
  }, []);

  const persistCheckins = useCallback((data) => {
    try {
      localStorage.setItem('recentCheckins', JSON.stringify(data));
    } catch (error) {
      console.error('Failed to persist check-ins:', error);
    }
  }, []);

  const loadPersistedData = useCallback(() => {
    try {
      const savedLeaderboard = localStorage.getItem('pointsLeaderboard');
      if (savedLeaderboard) {
        const parsed = JSON.parse(savedLeaderboard);
        if (Array.isArray(parsed)) {
          setLeaderboard(parsed);
        }
      }

      const savedCheckins = localStorage.getItem('recentCheckins');
      if (savedCheckins) {
        const parsed = JSON.parse(savedCheckins);
        if (Array.isArray(parsed)) {
          setRecentCheckins(parsed);
        }
      }
    } catch (error) {
      console.error('Failed to load persisted points data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPersistedData();
  }, [loadPersistedData]);

  const handleCheckinEvent = useCallback((payload) => {
    const attendance = payload?.attendance;
    const user = attendance?.user;
    if (!user) return;

    const userName = user.fullName || user.employeeNumber || 'موظف';
    const checkInTime = attendance.checkInTime
      ? new Date(attendance.checkInTime).toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString('ar-JO', { hour: '2-digit', minute: '2-digit' });

    setRecentCheckins((prev) => {
      const updated = [
        {
          id: attendance.id,
          name: userName,
          department: user.department || 'غير محدد',
          time: checkInTime,
          avatar: user.profileImage || null,
        },
        ...prev.filter((entry) => entry.id !== attendance.id),
      ];
      const sliced = updated.slice(0, 6);
      persistCheckins(sliced);
      return sliced;
    });

    const defaultStatus = 'جيد جداً';

    setLeaderboard((prev) => {
      const existingIndex = prev.findIndex(
        (emp) =>
          emp.employeeNumber === user.employeeNumber ||
          emp.id === user._id ||
          emp.id === user.id
      );

      let updated;
      if (existingIndex >= 0) {
        updated = prev.map((emp, idx) =>
          idx === existingIndex
            ? {
                ...emp,
                points: emp.points + 5,
                streak: (emp.streak || 0) + 1,
                status: defaultStatus,
                avatar: user.profileImage || emp.avatar || null,
              }
            : emp
        );
      } else {
        updated = [
          {
            id: user._id || user.id || user.employeeNumber || Date.now(),
            name: userName,
            employeeNumber: user.employeeNumber,
            points: 50,
            rank: prev.length + 1,
            streak: 1,
            avatar: user.profileImage || null,
            status: defaultStatus,
          },
          ...prev,
        ];
      }

      updated.sort((a, b) => b.points - a.points);
      const ranked = updated.map((emp, index) => ({ ...emp, rank: index + 1 }));
      persistLeaderboard(ranked);
      return ranked;
    });

    toast({
      title: 'تم تسجيل حضور جديد',
      description: `${userName} قام بتسجيل الدخول للتو`,
      status: 'success',
      duration: 3000,
      isClosable: true,
    });
  }, [toast, persistLeaderboard, persistCheckins]);

  useSocket(
    null,
    null,
    {
      'attendance:checkin': handleCheckinEvent,
    }
  );

  const getRankColor = (rank) => {
    switch (rank) {
      case 1:
        return 'yellow.400'; // Gold
      case 2:
        return 'gray.400'; // Silver
      case 3:
        return 'orange.600'; // Bronze
      default:
        return 'gray.600';
    }
  };

  const getRankIcon = (rank) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return `#${rank}`;
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <Center h="50vh">
          <Spinner size="xl" color="blue.500" />
        </Center>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Box>
        <Heading mb={6} color="gray.700">نظام النقاط</Heading>
        
        {/* Points Rules */}
        <Card mb={6}>
          <CardBody>
            <Heading size="md" mb={4}>قواعد النقاط</Heading>
            <SimpleGrid columns={{ base: 1, md: 3 }} spacing={4}>
              <HStack spacing={3}>
                <Icon as={FiAward} boxSize={6} color="green.500" />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold">+10 نقاط</Text>
                  <Text fontSize="sm" color="gray.600">حضور في الوقت</Text>
                </VStack>
              </HStack>
              <HStack spacing={3}>
                <Icon as={FiStar} boxSize={6} color="blue.500" />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold">+20 نقطة</Text>
                  <Text fontSize="sm" color="gray.600">شهر كامل بدون تأخير</Text>
                </VStack>
              </HStack>
              <HStack spacing={3}>
                <Icon as={FiTrendingUp} boxSize={6} color="purple.500" />
                <VStack align="start" spacing={0}>
                  <Text fontWeight="bold">+5 نقاط</Text>
                  <Text fontSize="sm" color="gray.600">أسبوع متواصل</Text>
                </VStack>
              </HStack>
            </SimpleGrid>
          </CardBody>
        </Card>

        {/* Leaderboard */}
        <Card>
          <CardBody>
            <Heading size="md" mb={4}>لوحة المتصدرين</Heading>
            {leaderboard.length === 0 ? (
              <Text color="gray.500">
                لا توجد بيانات بعد. عند تسجيل أي موظف للحضور سيظهر هنا مباشرة.
              </Text>
            ) : (
            <Table variant="simple">
              <Thead>
                <Tr>
                  <Th>الترتيب</Th>
                  <Th>الموظف</Th>
                  <Th>النقاط</Th>
                  <Th>سلسلة الأيام</Th>
                  <Th>الحالة</Th>
                </Tr>
              </Thead>
              <Tbody>
                {leaderboard.map((employee) => (
                  <Tr key={employee.id} bg={employee.rank <= 3 ? 'gray.50' : 'transparent'}>
                    <Td>
                      <Text fontSize="2xl" fontWeight="bold" color={getRankColor(employee.rank)}>
                        {getRankIcon(employee.rank)}
                      </Text>
                    </Td>
                    <Td>
                      <HStack spacing={3}>
                        <Avatar size="sm" name={employee.name} src={employee.avatar} />
                        <Text fontWeight="medium">{employee.name}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <HStack>
                        <Icon as={FiAward} color="yellow.500" />
                        <Text fontWeight="bold" fontSize="lg">{employee.points}</Text>
                      </HStack>
                    </Td>
                    <Td>
                      <Badge colorScheme="green" fontSize="md">
                        {employee.streak} يوم
                      </Badge>
                    </Td>
                    <Td>
                      {employee.rank === 1 ? (
                        <Badge colorScheme="yellow" fontSize="md">الأفضل</Badge>
                      ) : employee.rank === 2 ? (
                        <Badge colorScheme="gray" fontSize="md">ممتاز</Badge>
                      ) : employee.rank === 3 ? (
                        <Badge colorScheme="orange" fontSize="md">جيد جداً</Badge>
                      ) : (
                        <Badge colorScheme="purple" fontSize="md">
                          {employee.status || 'جيد جداً'}
                        </Badge>
                      )}
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
            )}
          </CardBody>
        </Card>

        {/* Recent check-ins */}
        <Card mt={6}>
          <CardBody>
            <Heading size="md" mb={4}>أحدث عمليات الحضور</Heading>
            {recentCheckins.length === 0 ? (
              <Text color="gray.500">لم يتم تسجيل حضور جديد بعد.</Text>
            ) : (
              <VStack align="stretch" spacing={3}>
                {recentCheckins.map((entry) => (
                  <HStack
                    key={entry.id}
                    justify="space-between"
                    p={3}
                    borderWidth="1px"
                    borderRadius="md"
                    bg="gray.50"
                  >
                    <HStack spacing={3}>
                      <Avatar size="sm" name={entry.name} src={entry.avatar} />
                      <VStack align="start" spacing={0}>
                        <Text fontWeight="semibold">{entry.name}</Text>
                        <Text fontSize="sm" color="gray.500">
                          القسم: {entry.department}
                        </Text>
                      </VStack>
                    </HStack>
                    <Badge colorScheme="green" fontSize="md">
                      {entry.time}
                    </Badge>
                  </HStack>
                ))}
              </VStack>
            )}
          </CardBody>
        </Card>
      </Box>
    </MainLayout>
  );
};

export default Points;





