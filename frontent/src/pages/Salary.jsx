import React, { useState, useEffect } from 'react';
import {
  Box,
  Heading,
  useToast,
  Spinner,
  Center,
  Text,
  SimpleGrid,
  HStack,
  VStack,
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
  Button,
  Select,
  Input,
  IconButton,
  useDisclosure,
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  FormControl,
  FormLabel,
  NumberInput,
  NumberInputField,
  NumberInputStepper,
  NumberIncrementStepper,
  NumberDecrementStepper,
  Stat,
  StatLabel,
  StatNumber,
  StatHelpText,
  Icon,
  Divider,
  Alert,
  AlertIcon,
  Avatar,
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from '@chakra-ui/react';
import { FiDollarSign, FiClock, FiUser, FiEdit2, FiRefreshCw, FiCalendar } from 'react-icons/fi';
import MainLayout from '../components/Layout/MainLayout';
import { salaryAPI, dashboardAPI, BASE_URL } from '../services/api';

const Salary = () => {
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [salaryData, setSalaryData] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filterEmployeeId, setFilterEmployeeId] = useState('all'); // Filter for statistics
  const [editSalary, setEditSalary] = useState({ baseSalary: 0, overtimeRate: 1.5 });
  const [savedSalaries, setSavedSalaries] = useState([]);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [activeTab, setActiveTab] = useState(0); // 0 = calculate, 1 = saved
  
  const { isOpen: isEditOpen, onOpen: onEditOpen, onClose: onEditClose } = useDisclosure();
  const toast = useToast();

  // Helper function to get full image URL
  const getProfileImageUrl = (profileImage) => {
    if (!profileImage) return null;
    if (profileImage.startsWith('http')) return profileImage;
    return `${BASE_URL}${profileImage}`;
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (employees.length > 0) {
      calculateSalaries();
    }
  }, [selectedYear, selectedMonth, employees]);

  const fetchEmployees = async () => {
    try {
      const response = await salaryAPI.getAllEmployees();
      setEmployees(response.data || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحميل بيانات الموظفين',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const calculateSalaries = async () => {
    setCalculating(true);
    try {
      const response = await salaryAPI.calculate({
        year: selectedYear,
        month: selectedMonth,
      });
      setSalaryData(response.data || []);
      toast({
        title: 'نجح',
        description: 'تم حساب وحفظ الرواتب بنجاح في قاعدة البيانات',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      // Refresh saved salaries after calculation
      if (activeTab === 1) {
        fetchSavedSalaries();
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل حساب الرواتب',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setCalculating(false);
      setLoading(false);
    }
  };

  const fetchSavedSalaries = async () => {
    setLoadingSaved(true);
    try {
      const response = await salaryAPI.getSaved({
        year: selectedYear,
        month: selectedMonth,
      });
      setSavedSalaries(response.data || []);
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل جلب الرواتب المحفوظة',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    } finally {
      setLoadingSaved(false);
    }
  };

  useEffect(() => {
    if (activeTab === 1) {
      fetchSavedSalaries();
    }
  }, [activeTab, selectedYear, selectedMonth]);

  const handleEditSalary = (employee) => {
    setSelectedEmployee(employee);
    setEditSalary({
      baseSalary: employee.baseSalary || 0,
      overtimeRate: employee.overtimeRate || 1.5,
    });
    onEditOpen();
  };

  const handleUpdateSalary = async () => {
    try {
      await salaryAPI.updateEmployee(selectedEmployee._id, editSalary);
      toast({
        title: 'نجح',
        description: 'تم تحديث الراتب بنجاح',
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      onEditClose();
      await fetchEmployees();
      await calculateSalaries();
    } catch (error) {
      toast({
        title: 'خطأ',
        description: error.message || 'فشل تحديث الراتب',
        status: 'error',
        duration: 5000,
        isClosable: true,
      });
    }
  };

  // Filter salary data based on selected employee
  const filteredSalaryData = filterEmployeeId === 'all' 
    ? salaryData 
    : salaryData.filter(item => item.employee._id === filterEmployeeId);

  // Calculate totals (for filtered or all employees)
  const totals = filteredSalaryData.reduce(
    (acc, item) => ({
      totalSalary: acc.totalSalary + (item.salary?.totalSalary || 0),
      totalBase: acc.totalBase + (item.salary?.baseSalaryAmount || 0),
      totalOvertime: acc.totalOvertime + (item.salary?.overtimeSalary || 0),
      totalOvertimeHours: acc.totalOvertimeHours + (item.hours?.overtimeHours || 0),
    }),
    { totalSalary: 0, totalBase: 0, totalOvertime: 0, totalOvertimeHours: 0 }
  );

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];

  // Helper function to format hours in a more readable way
  const formatHours = (hours) => {
    if (hours === 0) return '0 ساعة';
    
    const totalMinutes = Math.round(hours * 60);
    
    if (totalMinutes < 60) {
      return `حوالي ${totalMinutes} دقيقة`;
    }
    
    const hoursPart = Math.floor(hours);
    const minutesPart = Math.round((hours - hoursPart) * 60);
    
    if (minutesPart === 0) {
      return `${hoursPart} ساعة`;
    } else if (hoursPart === 0) {
      return `حوالي ${minutesPart} دقيقة`;
    } else {
      return `${hoursPart} ساعة و ${minutesPart} دقيقة`;
    }
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
          <Heading 
            color="gray.700"
            fontSize={{ base: "lg", md: "xl", lg: "2xl" }}
            flex={{ base: "1 1 100%", md: "0 1 auto" }}
          >
            إدارة الرواتب
          </Heading>
          <HStack 
            spacing={3} 
            flex={{ base: "0 0 auto", md: "0 1 auto" }}
            justify={{ base: "flex-end", md: "flex-end" }}
            w={{ base: "100%", md: "auto" }}
          >
            <IconButton
              icon={<FiRefreshCw />}
              aria-label="تحديث"
              onClick={() => {
                if (activeTab === 0) {
                  calculateSalaries();
                } else {
                  fetchSavedSalaries();
                }
              }}
              isLoading={activeTab === 0 ? calculating : loadingSaved}
              colorScheme="blue"
              variant="outline"
              size={{ base: "sm", md: "md" }}
            />
          </HStack>
        </HStack>

        {/* Tabs: Calculate vs Saved */}
        <Tabs index={activeTab} onChange={setActiveTab} mb={6} colorScheme="blue">
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
              حساب الرواتب
            </Tab>
            <Tab 
              fontSize={{ base: "xs", md: "sm" }}
              px={{ base: 2, md: 4 }}
              py={{ base: 2, md: 3 }}
              whiteSpace="nowrap"
            >
              الرواتب المحفوظة
            </Tab>
          </TabList>

          <TabPanels>
            {/* Tab 1: Calculate Salaries */}
            <TabPanel px={0}>
        {/* Filters */}
        <Card mb={6}>
          <CardBody>
            <HStack spacing={4} flexWrap="wrap">
              <FormControl width="150px">
                <FormLabel fontSize="sm">السنة</FormLabel>
                <Select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                >
                  {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <FormControl width="200px">
                <FormLabel fontSize="sm">الشهر</FormLabel>
                <Select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                >
                  {monthNames.map((month, index) => (
                    <option key={index + 1} value={index + 1}>
                      {month}
                    </option>
                  ))}
                </Select>
              </FormControl>
              <Button
                colorScheme="blue"
                onClick={calculateSalaries}
                isLoading={calculating}
                leftIcon={<Icon as={FiCalendar} />}
                mt={8}
              >
                حساب الرواتب
              </Button>
            </HStack>
          </CardBody>
        </Card>

        {/* Summary Stats */}
        {salaryData.length > 0 && (
          <>
            {/* Employee Filter */}
            <Card mb={4}>
              <CardBody>
                <HStack spacing={4} align="center">
                  <Text fontWeight="medium" color="gray.700">فلترة الإحصائيات:</Text>
                  <Select
                    value={filterEmployeeId}
                    onChange={(e) => setFilterEmployeeId(e.target.value)}
                    width="300px"
                  >
                    <option value="all">جميع الموظفين</option>
                    {salaryData.map((item) => (
                      <option key={item.employee._id} value={item.employee._id}>
                        {item.employee.fullName} ({item.employee.employeeNumber})
                      </option>
                    ))}
                  </Select>
                  {filterEmployeeId !== 'all' && (
                    <Badge colorScheme="blue" fontSize="sm" px={3} py={1}>
                      عرض موظف واحد
                    </Badge>
                  )}
                </HStack>
              </CardBody>
            </Card>

            <SimpleGrid columns={{ base: 1, md: 4 }} spacing={6} mb={6}>
              <Card>
                <CardBody>
                  <Stat>
                    <StatLabel>إجمالي الرواتب</StatLabel>
                    <StatNumber color="green.500">
                      {totals.totalSalary.toFixed(2)} د.أ
                    </StatNumber>
                    <StatHelpText>
                      {filterEmployeeId === 'all' 
                        ? `${salaryData.length} موظف`
                        : 'موظف واحد'}
                    </StatHelpText>
                  </Stat>
                </CardBody>
              </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>الراتب الأساسي</StatLabel>
                  <StatNumber color="blue.500">
                    {totals.totalBase.toFixed(2)} د.أ
                  </StatNumber>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>العمل الإضافي</StatLabel>
                  <StatNumber color="orange.500">
                    {totals.totalOvertime.toFixed(2)} د.أ
                  </StatNumber>
                  <StatHelpText>
                    {totals.totalOvertimeHours.toFixed(2)} ساعة
                  </StatHelpText>
                </Stat>
              </CardBody>
            </Card>
            <Card>
              <CardBody>
                <Stat>
                  <StatLabel>متوسط الراتب</StatLabel>
                  <StatNumber color="purple.500">
                    {filterEmployeeId === 'all' && filteredSalaryData.length > 0
                      ? (totals.totalSalary / filteredSalaryData.length).toFixed(2)
                      : totals.totalSalary.toFixed(2)} د.أ
                  </StatNumber>
                  {filterEmployeeId === 'all' && (
                    <StatHelpText>
                      متوسط {filteredSalaryData.length} موظف
                    </StatHelpText>
                  )}
                </Stat>
              </CardBody>
            </Card>
          </SimpleGrid>
          </>
        )}

        {/* Salary Table */}
        {loading ? (
          <Center py={10}>
            <Spinner size="xl" color="blue.500" />
          </Center>
        ) : salaryData.length === 0 ? (
          <Card>
            <CardBody>
              <Center py={10}>
                <VStack spacing={4}>
                  <Icon as={FiDollarSign} boxSize={12} color="gray.400" />
                  <Text color="gray.500">لا توجد بيانات رواتب للعرض</Text>
                  <Text fontSize="sm" color="gray.400">
                    اختر السنة والشهر واضغط على "حساب الرواتب"
                  </Text>
                </VStack>
              </Center>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody p={0}>
              <TableContainer overflowX="auto" maxW="100%">
                <Table variant="simple" size={{ base: "sm", md: "md" }}>
                <Thead>
                  <Tr>
                    <Th>الموظف</Th>
                    <Th>الراتب المحدد</Th>
                    <Th>أيام الحضور</Th>
                    <Th title="إجمالي ساعات العمل (من الحضور حتى الانصراف)">ساعات العمل</Th>
                    <Th>ساعات إضافية</Th>
                    <Th>الراتب حسب الحضور</Th>
                    <Th>راتب العمل الإضافي</Th>
                    <Th>إجمالي الراتب</Th>
                    <Th>الإجراءات</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {salaryData.map((item) => (
                    <Tr key={item.employee._id}>
                      <Td>
                        <HStack spacing={3}>
                          <Avatar
                            size="sm"
                            name={item.employee.fullName}
                            src={getProfileImageUrl(item.employee.profileImage)}
                          />
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="medium">{item.employee.fullName}</Text>
                            <Text fontSize="xs" color="gray.500">
                              {item.employee.employeeNumber}
                            </Text>
                            {item.employee.department && (
                              <Text fontSize="xs" color="gray.400">
                                {item.employee.department}
                              </Text>
                            )}
                          </VStack>
                        </HStack>
                      </Td>
                      <Td>
                        <Text fontWeight="bold" color="blue.600">
                          {item.employee.baseSalary.toFixed(2)} د.أ
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          شهرياً
                        </Text>
                      </Td>
                      <Td>
                        <VStack align="start" spacing={0}>
                          <Badge colorScheme="green">
                            {item.attendance.presentDays} يوم
                          </Badge>
                          <Text fontSize="xs" color="gray.500">
                            من {item.attendance.workingDays} يوم عمل
                          </Text>
                        </VStack>
                      </Td>
                      <Td>
                        <Text fontWeight="medium" color="gray.700">
                          {formatHours(item.hours.totalWorkingHours)}
                        </Text>
                        <Text fontSize="xs" color="gray.500" mt={1}>
                          عادي: {formatHours(item.hours.regularHours)}
                        </Text>
                        {item.hours.overtimeHours > 0 && (
                          <Text fontSize="xs" color="orange.600" mt={0.5}>
                            إضافي: {formatHours(item.hours.overtimeHours)}
                          </Text>
                        )}
                      </Td>
                      <Td>
                        {item.hours.overtimeHours > 0 ? (
                          <Badge colorScheme="orange" fontSize="sm">
                            {formatHours(item.hours.overtimeHours)}
                          </Badge>
                        ) : (
                          <Text color="gray.400">-</Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontWeight="medium" color="blue.600">
                          {item.salary.baseSalaryAmount.toFixed(2)} د.أ
                        </Text>
                        <Text fontSize="xs" color="gray.500">
                          {item.salary.dailySalary.toFixed(2)} × {item.attendance.presentDays}
                        </Text>
                      </Td>
                      <Td>
                        {item.salary.overtimeSalary > 0 ? (
                          <VStack align="start" spacing={0}>
                            <Text fontWeight="medium" color="orange.600">
                              {item.salary.overtimeSalary.toFixed(2)} د.أ
                            </Text>
                            <Text fontSize="xs" color="gray.500">
                              {item.hours.overtimeHours.toFixed(2)} × {item.salary.hourlySalary.toFixed(2)} × {item.employee.overtimeRate}
                            </Text>
                          </VStack>
                        ) : (
                          <Text color="gray.400">-</Text>
                        )}
                      </Td>
                      <Td>
                        <Text fontWeight="bold" fontSize="lg" color="green.600">
                          {item.salary.totalSalary.toFixed(2)} د.أ
                        </Text>
                      </Td>
                      <Td>
                        <IconButton
                          icon={<FiEdit2 />}
                          aria-label="تعديل الراتب"
                          size="sm"
                          colorScheme="blue"
                          variant="ghost"
                          onClick={() => handleEditSalary(item.employee)}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
              </TableContainer>
            </CardBody>
          </Card>
        )}

        {/* Edit Salary Modal */}
        <Modal isOpen={isEditOpen} onClose={onEditClose} size="md">
          <ModalOverlay />
          <ModalContent>
            <ModalHeader>تعديل الراتب</ModalHeader>
            <ModalCloseButton />
            <ModalBody>
              {selectedEmployee && (
                <VStack spacing={4} align="stretch">
                  <Box>
                    <Text fontWeight="bold" fontSize="lg">
                      {selectedEmployee.fullName}
                    </Text>
                    <Text fontSize="sm" color="gray.500">
                      {selectedEmployee.employeeNumber}
                    </Text>
                  </Box>
                  <Divider />
                  <FormControl>
                    <FormLabel>الراتب الأساسي الشهري (د.أ)</FormLabel>
                    <NumberInput
                      value={editSalary.baseSalary}
                      onChange={(_, value) =>
                        setEditSalary({ ...editSalary, baseSalary: value || 0 })
                      }
                      min={0}
                      precision={2}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                  </FormControl>
                  <FormControl>
                    <FormLabel>معدل العمل الإضافي (مضاعف)</FormLabel>
                    <NumberInput
                      value={editSalary.overtimeRate}
                      onChange={(_, value) =>
                        setEditSalary({ ...editSalary, overtimeRate: value || 1.5 })
                      }
                      min={1}
                      precision={2}
                      step={0.1}
                    >
                      <NumberInputField />
                      <NumberInputStepper>
                        <NumberIncrementStepper />
                        <NumberDecrementStepper />
                      </NumberInputStepper>
                    </NumberInput>
                    <Text fontSize="xs" color="gray.500" mt={1}>
                      مثال: 1.5 يعني 150% من الراتب الأساسي للساعة
                    </Text>
                  </FormControl>
                </VStack>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="ghost" mr={3} onClick={onEditClose}>
                إلغاء
              </Button>
              <Button colorScheme="blue" onClick={handleUpdateSalary}>
                حفظ
              </Button>
            </ModalFooter>
          </ModalContent>
        </Modal>

            </TabPanel>

            {/* Tab 2: Saved Salaries */}
            <TabPanel px={0}>
              <Card mb={6}>
                <CardBody>
                  <HStack spacing={4} flexWrap="wrap">
                    <FormControl width="150px">
                      <FormLabel fontSize="sm">السنة</FormLabel>
                      <Select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                      >
                        {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map((year) => (
                          <option key={year} value={year}>
                            {year}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <FormControl width="200px">
                      <FormLabel fontSize="sm">الشهر</FormLabel>
                      <Select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                      >
                        {monthNames.map((month, index) => (
                          <option key={index + 1} value={index + 1}>
                            {month}
                          </option>
                        ))}
                      </Select>
                    </FormControl>
                    <Button
                      colorScheme="blue"
                      onClick={fetchSavedSalaries}
                      isLoading={loadingSaved}
                      leftIcon={<Icon as={FiRefreshCw} />}
                      mt={8}
                    >
                      تحديث
                    </Button>
                  </HStack>
                </CardBody>
              </Card>

              {loadingSaved ? (
                <Center py={10}>
                  <Spinner size="xl" color="blue.500" />
                </Center>
              ) : savedSalaries.length === 0 ? (
                <Card>
                  <CardBody>
                    <Center py={10}>
                      <VStack spacing={4}>
                        <Icon as={FiDollarSign} boxSize={12} color="gray.400" />
                        <Text color="gray.500">لا توجد رواتب محفوظة للعرض</Text>
                        <Text fontSize="sm" color="gray.400">
                          احسب الرواتب أولاً من تبويب "حساب الرواتب"
                        </Text>
                      </VStack>
                    </Center>
                  </CardBody>
                </Card>
              ) : (
                <Card>
                  <CardBody>
                    <TableContainer overflowX="auto" maxW="100%">
                      <Table variant="simple" size={{ base: "sm", md: "md" }}>
                      <Thead>
                        <Tr>
                          <Th>الموظف</Th>
                          <Th>الشهر</Th>
                          <Th>أيام الحضور</Th>
                          <Th>ساعات العمل الإضافية</Th>
                          <Th>الراتب الأساسي</Th>
                          <Th>راتب العمل الإضافي</Th>
                          <Th>إجمالي الراتب</Th>
                          <Th>الحالة</Th>
                          <Th>تاريخ الحساب</Th>
                        </Tr>
                      </Thead>
                      <Tbody>
                        {savedSalaries.map((salary) => (
                          <Tr key={salary._id}>
                            <Td>
                              <HStack spacing={3}>
                                <Avatar
                                  size="sm"
                                  name={salary.user?.fullName}
                                  src={getProfileImageUrl(salary.user?.profileImage)}
                                />
                                <VStack align="start" spacing={0}>
                                  <Text fontWeight="medium">{salary.user?.fullName}</Text>
                                  <Text fontSize="xs" color="gray.500">
                                    {salary.user?.employeeNumber}
                                  </Text>
                                </VStack>
                              </HStack>
                            </Td>
                            <Td>
                              <Text fontWeight="medium">
                                {new Date(salary.year, salary.month - 1).toLocaleDateString('ar-JO', { 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
                              </Text>
                            </Td>
                            <Td>
                              <Badge colorScheme="green">
                                {salary.attendance?.presentDays} يوم
                              </Badge>
                            </Td>
                            <Td>
                              {salary.hours?.overtimeHours > 0 ? (
                                <Badge colorScheme="orange">
                                  {formatHours(salary.hours.overtimeHours)}
                                </Badge>
                              ) : (
                                <Text color="gray.400">-</Text>
                              )}
                            </Td>
                            <Td>
                              <Text fontWeight="medium" color="blue.600">
                                {salary.salary?.baseSalaryAmount?.toFixed(2)} د.أ
                              </Text>
                            </Td>
                            <Td>
                              {salary.salary?.overtimeSalary > 0 ? (
                                <Text fontWeight="medium" color="orange.600">
                                  {salary.salary.overtimeSalary.toFixed(2)} د.أ
                                </Text>
                              ) : (
                                <Text color="gray.400">-</Text>
                              )}
                            </Td>
                            <Td>
                              <Text fontWeight="bold" fontSize="lg" color="green.600">
                                {salary.salary?.totalSalary?.toFixed(2)} د.أ
                              </Text>
                            </Td>
                            <Td>
                              <Badge 
                                colorScheme={
                                  salary.status === 'paid' ? 'green' :
                                  salary.status === 'approved' ? 'blue' : 'gray'
                                }
                              >
                                {salary.status === 'paid' ? 'مدفوع' :
                                 salary.status === 'approved' ? 'موافق عليه' : 'محسوب'}
                              </Badge>
                            </Td>
                            <Td>
                              <Text fontSize="sm" color="gray.600">
                                {new Date(salary.createdAt).toLocaleDateString('ar-JO')}
                              </Text>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                    </TableContainer>
                  </CardBody>
                </Card>
              )}
            </TabPanel>
          </TabPanels>
        </Tabs>
      </Box>
    </MainLayout>
  );
};

export default Salary;

